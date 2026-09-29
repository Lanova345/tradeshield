import hashlib
import hmac
from datetime import datetime, timezone
from uuid import UUID, uuid4

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Consultation, Payment, Scan


class PaymentError(ValueError):
    pass


async def initialize_consultation_payment(session: AsyncSession, email: str, phone: str, question: str) -> dict[str, str]:
    if not settings.paystack_secret_key:
        raise PaymentError("Paystack is not configured.")

    consultation_id = uuid4()
    reference = f"TSC-{consultation_id.hex.upper()}"
    amount_minor = settings.consultation_price_kes * 100
    payload = {
        "email": email,
        "amount": amount_minor,
        "currency": "KES",
        "reference": reference,
        "mobile_money": {"phone": phone, "provider": "mpesa"},
        "metadata": {"consultation_id": str(consultation_id), "product": "Trade Shield consultation", "provider": "mpesa"},
    }
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            response = await client.post("https://api.paystack.co/charge", json=payload, headers={"Authorization": f"Bearer {settings.paystack_secret_key}"})
        response.raise_for_status()
        result = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise PaymentError("Paystack checkout could not be initialized.") from error
    if result.get("status") is not True:
        raise PaymentError("Paystack rejected the checkout request.")

    data = result.get("data", {})
    if data.get("reference") != reference or data.get("status") != "pay_offline":
        raise PaymentError("Paystack did not return a valid M-Pesa authorization prompt.")

    session.add(Consultation(
        id=consultation_id,
        email=email,
        question=question,
        payment_reference=reference,
        amount_minor=amount_minor,
        currency="KES",
        status="PENDING_PAYMENT",
    ))
    await session.commit()
    return {
        "reference": reference,
        "status": data["status"],
        "display_text": data.get("display_text") or "Approve the M-Pesa prompt on your phone to complete payment.",
    }


async def verify_consultation_payment(session: AsyncSession, reference: str) -> Consultation:
    if not settings.paystack_secret_key:
        raise PaymentError("Paystack is not configured.")
    consultation = await session.scalar(select(Consultation).where(Consultation.payment_reference == reference).with_for_update())
    if consultation is None:
        raise PaymentError("Consultation payment reference was not created by this service.")
    if consultation.status == "PAID":
        return consultation

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            response = await client.get(f"https://api.paystack.co/transaction/verify/{reference}", headers={"Authorization": f"Bearer {settings.paystack_secret_key}"})
        response.raise_for_status()
        result = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise PaymentError("Paystack transaction status could not be verified.") from error
    if result.get("status") is not True:
        raise PaymentError("Paystack could not verify this transaction.")

    transaction = result.get("data", {})
    metadata = transaction.get("metadata") or {}
    if transaction.get("reference") != reference:
        raise PaymentError("Paystack returned a different consultation reference.")
    if transaction.get("status") != "success":
        return consultation
    if (
        transaction.get("amount") != consultation.amount_minor
        or transaction.get("currency") != "KES"
        or transaction.get("channel") != "mobile_money"
        or metadata.get("consultation_id") != str(consultation.id)
        or metadata.get("product") != "Trade Shield consultation"
        or metadata.get("provider") != "mpesa"
    ):
        raise PaymentError("Transaction channel, amount, currency, or consultation metadata did not match.")

    consultation.status = "PAID"
    consultation.paid_at = datetime.now(timezone.utc)
    await session.commit()
    return consultation


async def initialize_payment(session: AsyncSession, scan: Scan, email: str, user_id: UUID, phone: str) -> dict[str, str]:
    if not settings.paystack_secret_key:
        raise PaymentError("Paystack is not configured.")
    if scan.status != "PENDING_PAYMENT":
        raise PaymentError("This scan is not awaiting payment.")
    reference = f"TS-{scan.id.hex[:12].upper()}-{uuid4().hex[:12].upper()}"
    amount_minor = settings.scan_price_kes * 100
    payload = {
        "email": email,
        "amount": amount_minor,
        "currency": "KES",
        "reference": reference,
        "mobile_money": {"phone": phone, "provider": "mpesa"},
        "metadata": {"scan_id": str(scan.id), "product": "Trade Shield website assessment", "provider": "mpesa"},
    }
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            response = await client.post("https://api.paystack.co/charge", json=payload, headers={"Authorization": f"Bearer {settings.paystack_secret_key}"})
        response.raise_for_status()
        result = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise PaymentError("Paystack checkout could not be initialized.") from error
    if result.get("status") is not True:
        raise PaymentError("Paystack rejected the checkout request.")
    data = result.get("data", {})
    if data.get("reference") != reference or data.get("status") != "pay_offline":
        raise PaymentError("Paystack did not return a valid M-Pesa authorization prompt.")
    session.add(Payment(user_id=user_id, scan_id=scan.id, reference=reference, payer_email=email, amount_minor=amount_minor, currency="KES", status="PENDING"))
    await session.commit()
    return {
        "reference": reference,
        "status": data["status"],
        "display_text": data.get("display_text") or "Approve the M-Pesa prompt on your phone to complete payment.",
    }


async def verify_payment(session: AsyncSession, reference: str, expected_scan_id: UUID | None = None) -> Payment:
    if not settings.paystack_secret_key:
        raise PaymentError("Paystack is not configured.")
    payment = await session.scalar(select(Payment).where(Payment.reference == reference).with_for_update())
    if payment is None:
        raise PaymentError("Payment reference was not created by this service.")
    if expected_scan_id and payment.scan_id != expected_scan_id:
        raise PaymentError("Payment reference does not belong to this scan.")
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            response = await client.get(f"https://api.paystack.co/transaction/verify/{reference}", headers={"Authorization": f"Bearer {settings.paystack_secret_key}"})
        response.raise_for_status()
        result = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise PaymentError("Paystack transaction status could not be verified.") from error
    if result.get("status") is not True:
        raise PaymentError("Paystack could not verify this transaction.")
    transaction = result.get("data", {})
    metadata = transaction.get("metadata") or {}
    scan = await session.get(Scan, payment.scan_id, with_for_update=True)
    valid = (
        scan is not None
        and transaction.get("reference") == payment.reference
        and transaction.get("status") == "success"
        and transaction.get("amount") == payment.amount_minor == settings.scan_price_kes * 100
        and transaction.get("currency") == payment.currency == "KES"
        and transaction.get("channel") == "mobile_money"
        and metadata.get("scan_id") == str(payment.scan_id)
        and metadata.get("provider") == "mpesa"
    )
    if not valid:
        raise PaymentError("Transaction status, amount, currency, or scan metadata did not match.")
    if payment.status != "PAID":
        payment.status = "PAID"
        payment.paid_at = datetime.now(timezone.utc)
        scan.status = "QUEUED"
        await session.commit()
    return payment


def verify_webhook_signature(raw_body: bytes, signature: str | None) -> bool:
    if not settings.paystack_secret_key or not signature:
        return False
    digest = hmac.new(settings.paystack_secret_key.encode(), raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(digest, signature)
