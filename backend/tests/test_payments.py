import hashlib
import hmac
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks
from pydantic import ValidationError

from app.api import queue_paid_scan
from app.core.config import settings
from app.models import Consultation, Payment, Scan
from app.schemas import ConsultationCreate
from app.services.payments import PaymentError, initialize_consultation_payment, initialize_payment, verify_consultation_payment, verify_webhook_signature


class FakeSession:
    def __init__(self):
        self.items = []
        self.commits = 0

    def add(self, item):
        self.items.append(item)

    async def commit(self):
        self.commits += 1


class FakePaystackResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {"status": True, "data": {"reference": self.reference, "status": "pay_offline", "display_text": "Approve the M-Pesa prompt on your phone."}}


class FakePaystackClient:
    request_payload = None

    def __init__(self, **_options):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, *, json, headers):
        type(self).request_payload = json
        type(self).request_headers = headers
        type(self).request_url = url
        response = FakePaystackResponse()
        response.reference = json["reference"]
        return response


class FakeScanSession:
    def __init__(self, scan, payment_id):
        self.scan = scan
        self.payment_id = payment_id
        self.scalar_calls = 0
        self.commits = 0

    async def scalar(self, _statement):
        self.scalar_calls += 1
        return self.scan if self.scalar_calls % 2 == 1 else self.payment_id

    async def commit(self):
        self.commits += 1


def test_paystack_webhook_signature_uses_raw_body_and_constant_time_comparison(monkeypatch) -> None:
    secret = "local-test-secret-with-enough-entropy"
    monkeypatch.setattr(settings, "paystack_secret_key", secret)
    body = b'{"event":"charge.success","data":{"reference":"TS-123"}}'
    signature = hmac.new(secret.encode(), body, hashlib.sha512).hexdigest()
    assert verify_webhook_signature(body, signature)
    assert not verify_webhook_signature(body + b" ", signature)
    assert not verify_webhook_signature(body, None)


@pytest.mark.asyncio
async def test_checkout_uses_registered_email_kes_amount_and_mpesa_number(monkeypatch) -> None:
    import app.services.payments as payments

    monkeypatch.setattr(settings, "paystack_secret_key", "test-secret")
    monkeypatch.setattr(settings, "scan_price_kes", 500)
    monkeypatch.setattr(payments.httpx, "AsyncClient", FakePaystackClient)
    session = FakeSession()
    scan = Scan(id=uuid4(), user_id=uuid4(), url="https://example.com", normalized_url="https://example.com", status="PENDING_PAYMENT")
    user_id = scan.user_id

    checkout = await initialize_payment(session, scan, "account@example.com", user_id, "+254712345678")

    payment = next(item for item in session.items if isinstance(item, Payment))
    assert checkout["status"] == "pay_offline"
    assert checkout["display_text"] == "Approve the M-Pesa prompt on your phone."
    assert FakePaystackClient.request_url == "https://api.paystack.co/charge"
    assert FakePaystackClient.request_payload["email"] == "account@example.com"
    assert FakePaystackClient.request_payload["amount"] == 50_000
    assert FakePaystackClient.request_payload["currency"] == "KES"
    assert FakePaystackClient.request_payload["mobile_money"] == {"phone": "+254712345678", "provider": "mpesa"}
    assert payment.user_id == user_id
    assert payment.scan_id == scan.id
    assert payment.reference == checkout["reference"]
    assert session.commits == 1


@pytest.mark.asyncio
async def test_checkout_requires_paystack_configuration(monkeypatch) -> None:
    monkeypatch.setattr(settings, "paystack_secret_key", None)
    scan = Scan(id=uuid4(), user_id=uuid4(), url="https://example.com", normalized_url="https://example.com", status="PENDING_PAYMENT")

    with pytest.raises(PaymentError, match="not configured"):
        await initialize_payment(FakeSession(), scan, "account@example.com", scan.user_id, "+254712345678")


@pytest.mark.asyncio
async def test_consultation_checkout_is_kes_2000_and_uses_mpesa_stk(monkeypatch) -> None:
    import app.services.payments as payments

    monkeypatch.setattr(settings, "paystack_secret_key", "test-secret")
    monkeypatch.setattr(settings, "consultation_price_kes", 2000)

    class MpesaResponse:
        def __init__(self, reference):
            self.reference = reference

        def raise_for_status(self):
            return None

        def json(self):
            return {"status": True, "data": {"reference": self.reference, "status": "pay_offline", "display_text": "Approve the M-Pesa prompt on your phone."}}

    class MpesaClient:
        request_payload = None
        request_url = None

        def __init__(self, **_options):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, *, json, headers):
            type(self).request_payload = json
            type(self).request_url = url
            return MpesaResponse(json["reference"])

    monkeypatch.setattr(payments.httpx, "AsyncClient", MpesaClient)
    session = FakeSession()

    checkout = await initialize_consultation_payment(session, "customer@example.com", "+254712345678", "Please review this trading platform.")

    consultation = next(item for item in session.items if isinstance(item, Consultation))
    assert MpesaClient.request_url == "https://api.paystack.co/charge"
    assert MpesaClient.request_payload["amount"] == 200_000
    assert MpesaClient.request_payload["currency"] == "KES"
    assert MpesaClient.request_payload["mobile_money"] == {"phone": "+254712345678", "provider": "mpesa"}
    assert MpesaClient.request_payload["metadata"]["consultation_id"] == str(consultation.id)
    assert consultation.payment_reference == checkout["reference"]
    assert consultation.status == "PENDING_PAYMENT"
    assert checkout["status"] == "pay_offline"
    assert session.commits == 1


def test_consultation_form_normalizes_kenyan_mpesa_phone_number() -> None:
    request = ConsultationCreate(email="customer@example.com", phone="0712 345 678", question="Please review this trading platform.")

    assert request.phone == "+254712345678"


def test_consultation_form_rejects_non_kenyan_mpesa_phone_number() -> None:
    with pytest.raises(ValidationError, match="valid Kenyan M-Pesa phone number"):
        ConsultationCreate(email="customer@example.com", phone="+1 555 555 5555", question="Please review this trading platform.")


@pytest.mark.asyncio
async def test_consultation_is_paid_only_after_matching_mobile_money_verification(monkeypatch) -> None:
    import app.services.payments as payments

    monkeypatch.setattr(settings, "paystack_secret_key", "test-secret")
    consultation = Consultation(
        id=uuid4(),
        email="customer@example.com",
        question="Please review this trading platform.",
        payment_reference="TSC-CONSULTATION-123",
        amount_minor=200_000,
        currency="KES",
        status="PENDING_PAYMENT",
    )

    class VerifyResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"status": True, "data": {"reference": consultation.payment_reference, "status": "success", "amount": 200_000, "currency": "KES", "channel": "mobile_money", "metadata": {"consultation_id": str(consultation.id), "product": "Trade Shield consultation", "provider": "mpesa"}}}

    class VerifyClient:
        def __init__(self, **_options):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, *_args, **_kwargs):
            return VerifyResponse()

    class VerifySession:
        def __init__(self):
            self.commits = 0

        async def scalar(self, _statement):
            return consultation

        async def commit(self):
            self.commits += 1

    monkeypatch.setattr(payments.httpx, "AsyncClient", VerifyClient)
    session = VerifySession()

    verified = await verify_consultation_payment(session, consultation.payment_reference)

    assert verified.status == "PAID"
    assert verified.paid_at is not None
    assert session.commits == 1


@pytest.mark.asyncio
async def test_consultation_payment_rejects_a_mismatched_amount(monkeypatch) -> None:
    import app.services.payments as payments

    monkeypatch.setattr(settings, "paystack_secret_key", "test-secret")
    consultation = Consultation(
        id=uuid4(),
        email="customer@example.com",
        question="Please review this trading platform.",
        payment_reference="TSC-CONSULTATION-456",
        amount_minor=200_000,
        currency="KES",
        status="PENDING_PAYMENT",
    )

    class VerifyResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"status": True, "data": {"reference": consultation.payment_reference, "status": "success", "amount": 50_000, "currency": "KES", "channel": "mobile_money", "metadata": {"consultation_id": str(consultation.id), "product": "Trade Shield consultation", "provider": "mpesa"}}}

    class VerifyClient:
        def __init__(self, **_options):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, *_args, **_kwargs):
            return VerifyResponse()

    class VerifySession:
        async def scalar(self, _statement):
            return consultation

        async def commit(self):
            raise AssertionError("Mismatched payments must not be committed.")

    monkeypatch.setattr(payments.httpx, "AsyncClient", VerifyClient)

    with pytest.raises(PaymentError, match="did not match"):
        await verify_consultation_payment(VerifySession(), consultation.payment_reference)

    assert consultation.status == "PENDING_PAYMENT"


@pytest.mark.asyncio
async def test_verified_payment_schedules_scan_once() -> None:
    scan = Scan(id=uuid4(), user_id=uuid4(), url="https://example.com", normalized_url="https://example.com", status="QUEUED")
    session = FakeScanSession(scan, uuid4())
    background_tasks = BackgroundTasks()

    queued_scan = await queue_paid_scan(scan.id, background_tasks, session)
    duplicate_scan = await queue_paid_scan(scan.id, background_tasks, session)

    assert queued_scan is scan
    assert duplicate_scan is scan
    assert scan.status == "COLLECTING_EVIDENCE"
    assert session.commits == 1
    assert len(background_tasks.tasks) == 1
