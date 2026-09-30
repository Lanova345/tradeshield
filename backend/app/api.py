import json
import re
from datetime import datetime, timezone
from hmac import compare_digest
from uuid import UUID, uuid4
from urllib.parse import urlsplit

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db import SessionFactory, get_session
from app.models import AuditLog, Consultation, Evidence, NewsArticle, Payment, RiskWeight, Scan, SiteReport, User
from app.schemas import AdminLoginInput, ArticlePublishConfirmation, AuthResponse, ConsultationCheckout, ConsultationCreate, ConsultationPaymentStatus, LoginInput, NewsArticleCreate, NewsArticleResponse, PaymentInitialized, PaymentStatus, PublicNewsArticle, RegisterInput, ReportArticleCreate, ScanCreate, ScanDetails, ScanPaymentCreate, ScanStatus, SiteReportCreate, SiteReportResponse, SiteReportReview
from app.services.auth import cookie_options, create_access_token, current_user, hash_password, verify_password
from app.services.analyzer import inspect_website
from app.services.ai_analysis import summarize_evidence
from app.services.payments import PaymentError, initialize_consultation_payment, initialize_payment, verify_consultation_payment, verify_payment, verify_webhook_signature
from app.services.risk_engine import DEFAULT_WEIGHTS, Signal, assess_confidence, assess_risk
from app.services.url_safety import UnsafeTarget, normalize_url
from app.services.url_safety import UnsafeTarget, normalize_url, resolve_public_addresses

router = APIRouter()


async def authenticated_user(request: Request, session: AsyncSession = Depends(get_session)) -> User:
    return await current_user(request, session)


async def admin_user(user: User = Depends(authenticated_user)) -> User:
    if user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access is required.")
    return user


@router.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterInput, response: Response, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    email = str(payload.email).strip().lower()
    if email == settings.admin_email.strip().lower():
        raise HTTPException(status_code=409, detail="This email address is reserved for the administrator account.")
    exists = await session.scalar(select(User.id).where(func.lower(User.email) == email))
    if exists:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(name=payload.name.strip(), email=email, phone=payload.phone, password_hash=hash_password(payload.password))
    try:
        session.add(user)
        await session.flush()
        session.add(AuditLog(user_id=user.id, action="USER_REGISTERED", resource="user", resource_id=str(user.id)))
        await session.commit()
        await session.refresh(user)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from error
    response.set_cookie(value=create_access_token(user), **cookie_options())
    return AuthResponse(id=user.id, name=user.name, email=user.email, role=user.role)


@router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginInput, response: Response, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    user = await session.scalar(select(User).where(func.lower(User.email) == str(payload.email).lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    response.set_cookie(value=create_access_token(user), **cookie_options())
    return AuthResponse(id=user.id, name=user.name, email=user.email, role=user.role)


@router.post("/admin/auth/login", response_model=AuthResponse)
async def admin_login(
    payload: AdminLoginInput, response: Response, session: AsyncSession = Depends(get_session)
) -> AuthResponse:
    if settings.admin_password is None or not compare_digest(payload.username, settings.admin_username):
        raise HTTPException(status_code=401, detail="Username or password is incorrect.")
    email = settings.admin_email.strip().lower()
    user = await session.scalar(select(User).where(func.lower(User.email) == email, User.role == "ADMIN"))
    if user is None or not verify_password(settings.admin_password.get_secret_value(), user.password_hash):
        raise HTTPException(status_code=401, detail="Username or password is incorrect.")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Username or password is incorrect.")
    response.set_cookie(value=create_access_token(user), **cookie_options())
    return AuthResponse(id=user.id, name=user.name, email=user.email, role=user.role)


@router.get("/auth/me", response_model=AuthResponse)
async def get_current_account(user: User = Depends(authenticated_user)) -> AuthResponse:
    return AuthResponse(id=user.id, name=user.name, email=user.email, role=user.role)


def normalized_public_url(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    try:
        normalized = normalize_url(value)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if not urlsplit(normalized).hostname:
        raise HTTPException(status_code=422, detail="Enter a valid public website address.")
    return normalized


def article_slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "news-update"


async def unique_article_slug(title: str, session: AsyncSession) -> str:
    base_slug = article_slug(title)[:200]
    slug = base_slug
    while await session.scalar(select(NewsArticle.id).where(NewsArticle.slug == slug)) is not None:
        slug = f"{base_slug[:188]}-{uuid4().hex[:8]}"
    return slug


def public_article(article: NewsArticle) -> PublicNewsArticle:
    return PublicNewsArticle.model_validate(article)


@router.post("/reports", response_model=SiteReportResponse, status_code=status.HTTP_201_CREATED)
async def submit_site_report(payload: SiteReportCreate, session: AsyncSession = Depends(get_session)) -> SiteReportResponse:
    website_url = normalized_public_url(payload.website_url)
    message = payload.message.strip()
    if len(message) < 20:
        raise HTTPException(status_code=422, detail="Please describe what happened in at least 20 characters.")
    report = SiteReport(website_url=website_url or "", message=message)
    session.add(report)
    await session.flush()
    session.add(AuditLog(action="SITE_REPORT_SUBMITTED", resource="site_report", resource_id=str(report.id)))
    await session.commit()
    await session.refresh(report)
    return SiteReportResponse.model_validate(report)


@router.get("/news", response_model=list[PublicNewsArticle])
async def list_public_news(session: AsyncSession = Depends(get_session)) -> list[PublicNewsArticle]:
    articles = await session.scalars(
        select(NewsArticle).where(NewsArticle.status == "PUBLISHED").order_by(NewsArticle.published_at.desc())
    )
    return [public_article(article) for article in articles]


@router.get("/news/{slug}", response_model=PublicNewsArticle)
async def get_public_news_article(slug: str, session: AsyncSession = Depends(get_session)) -> PublicNewsArticle:
    article = await session.scalar(select(NewsArticle).where(NewsArticle.slug == slug, NewsArticle.status == "PUBLISHED"))
    if article is None:
        raise HTTPException(status_code=404, detail="News article not found.")
    return public_article(article)


@router.get("/admin/reports", response_model=list[SiteReportResponse])
async def list_site_reports(
    user: User = Depends(admin_user), session: AsyncSession = Depends(get_session)
) -> list[SiteReportResponse]:
    reports = await session.scalars(select(SiteReport).order_by(SiteReport.submitted_at.desc()))
    return [SiteReportResponse.model_validate(report) for report in reports]


@router.post("/admin/reports/{report_id}/review", response_model=SiteReportResponse)
async def review_site_report(
    report_id: UUID,
    payload: SiteReportReview,
    user: User = Depends(admin_user),
    session: AsyncSession = Depends(get_session),
) -> SiteReportResponse:
    report = await session.get(SiteReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Site report not found.")
    if report.status in {"PUBLISHED", "DISMISSED"}:
        raise HTTPException(status_code=409, detail="This report has already been resolved.")
    report.status = "REVIEWING"
    report.review_notes = payload.notes.strip() if payload.notes else report.review_notes
    report.reviewed_at = datetime.now(timezone.utc)
    session.add(AuditLog(user_id=user.id, action="SITE_REPORT_REVIEWING", resource="site_report", resource_id=str(report.id)))
    await session.commit()
    await session.refresh(report)
    return SiteReportResponse.model_validate(report)


@router.post("/admin/reports/{report_id}/dismiss", response_model=SiteReportResponse)
async def dismiss_site_report(
    report_id: UUID,
    payload: SiteReportReview,
    user: User = Depends(admin_user),
    session: AsyncSession = Depends(get_session),
) -> SiteReportResponse:
    report = await session.get(SiteReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Site report not found.")
    if report.status == "PUBLISHED":
        raise HTTPException(status_code=409, detail="A published report cannot be dismissed.")
    report.status = "DISMISSED"
    report.review_notes = payload.notes.strip() if payload.notes else report.review_notes
    report.reviewed_at = datetime.now(timezone.utc)
    session.add(AuditLog(user_id=user.id, action="SITE_REPORT_DISMISSED", resource="site_report", resource_id=str(report.id)))
    await session.commit()
    await session.refresh(report)
    return SiteReportResponse.model_validate(report)


async def build_article(
    payload: NewsArticleCreate,
    user: User,
    session: AsyncSession,
    *,
    status_value: str,
    report_id: UUID | None = None,
) -> NewsArticle:
    title = payload.title.strip()
    summary = payload.summary.strip()
    content = payload.content.strip()
    source_urls = [normalized_public_url(source) for source in payload.source_urls]
    if not title or len(summary) < 20 or len(content) < 50:
        raise HTTPException(status_code=422, detail="Title, summary, and article content are required.")
    if status_value == "PUBLISHED" and not source_urls:
        raise HTTPException(status_code=422, detail="Add at least one source URL before publishing.")
    article = NewsArticle(
        report_id=report_id,
        author_id=user.id,
        title=title,
        slug=await unique_article_slug(title, session),
        site_url=normalized_public_url(payload.site_url),
        summary=summary,
        content=content,
        source_urls=[source for source in source_urls if source],
        status=status_value,
        published_at=datetime.now(timezone.utc) if status_value == "PUBLISHED" else None,
    )
    session.add(article)
    await session.flush()
    return article


@router.get("/admin/news", response_model=list[NewsArticleResponse])
async def list_admin_news(
    user: User = Depends(admin_user), session: AsyncSession = Depends(get_session)
) -> list[NewsArticleResponse]:
    articles = await session.scalars(select(NewsArticle).order_by(NewsArticle.created_at.desc()))
    return [NewsArticleResponse.model_validate(article) for article in articles]


@router.post("/admin/news", response_model=NewsArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_news_draft(
    payload: NewsArticleCreate,
    user: User = Depends(admin_user),
    session: AsyncSession = Depends(get_session),
) -> NewsArticleResponse:
    article = await build_article(payload, user, session, status_value="DRAFT")
    session.add(AuditLog(user_id=user.id, action="NEWS_DRAFT_CREATED", resource="news_article", resource_id=str(article.id)))
    await session.commit()
    await session.refresh(article)
    return NewsArticleResponse.model_validate(article)


@router.post("/admin/news/{article_id}/publish", response_model=NewsArticleResponse)
async def publish_news_draft(
    article_id: UUID,
    payload: ArticlePublishConfirmation,
    user: User = Depends(admin_user),
    session: AsyncSession = Depends(get_session),
) -> NewsArticleResponse:
    article = await session.get(NewsArticle, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="News article not found.")
    if article.status == "PUBLISHED":
        raise HTTPException(status_code=409, detail="This article is already published.")
    if not payload.confirm_sources_reviewed:
        raise HTTPException(status_code=422, detail="Confirm that the sources and claims have been reviewed.")
    if not article.source_urls:
        raise HTTPException(status_code=422, detail="Add at least one source URL before publishing.")
    article.status = "PUBLISHED"
    article.published_at = datetime.now(timezone.utc)
    session.add(AuditLog(user_id=user.id, action="NEWS_ARTICLE_PUBLISHED", resource="news_article", resource_id=str(article.id)))
    await session.commit()
    await session.refresh(article)
    return NewsArticleResponse.model_validate(article)


@router.post("/admin/reports/{report_id}/publish", response_model=NewsArticleResponse, status_code=status.HTTP_201_CREATED)
async def publish_report_as_article(
    report_id: UUID,
    payload: ReportArticleCreate,
    user: User = Depends(admin_user),
    session: AsyncSession = Depends(get_session),
) -> NewsArticleResponse:
    report = await session.get(SiteReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Site report not found.")
    if report.status in {"PUBLISHED", "DISMISSED"}:
        raise HTTPException(status_code=409, detail="This report has already been resolved.")
    if not payload.confirm_sources_reviewed:
        raise HTTPException(status_code=422, detail="Confirm that the sources and claims have been reviewed.")
    article = await build_article(payload, user, session, status_value="PUBLISHED", report_id=report.id)
    report.status = "PUBLISHED"
    report.reviewed_at = datetime.now(timezone.utc)
    session.add(AuditLog(user_id=user.id, action="SITE_REPORT_PUBLISHED", resource="site_report", resource_id=str(report.id)))
    await session.commit()
    await session.refresh(article)
    return NewsArticleResponse.model_validate(article)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    options = cookie_options()
    response.delete_cookie(key=options["key"], path="/", httponly=True, secure=options["secure"], samesite=options["samesite"])
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


def present_scan(scan: Scan) -> ScanStatus:
    return ScanStatus(id=scan.id, website=scan.normalized_url, status=scan.status, risk_score=scan.risk_score, risk_level=scan.risk_level, confidence=scan.confidence, summary=scan.ai_summary, created_at=scan.created_at)


async def queue_paid_scan(scan_id: UUID, background_tasks: BackgroundTasks, session: AsyncSession) -> Scan | None:
    scan = await session.scalar(select(Scan).where(Scan.id == scan_id).with_for_update())
    if scan is None or scan.status not in {"QUEUED", "PAID"}:
        return scan
    payment_id = await session.scalar(select(Payment.id).where(Payment.scan_id == scan_id, Payment.status == "PAID"))
    if payment_id is None:
        return scan
    scan.status = "COLLECTING_EVIDENCE"
    await session.commit()
    background_tasks.add_task(run_analysis, scan_id)
    return scan


@router.post("/scans", response_model=ScanStatus, status_code=status.HTTP_201_CREATED)
async def create_scan(payload: ScanCreate, user: User = Depends(authenticated_user), session: AsyncSession = Depends(get_session)) -> ScanStatus:
    try:
        normalized = normalize_url(payload.website)
        parsed_url = urlsplit(normalized)
        await resolve_public_addresses(parsed_url.hostname or "", parsed_url.port or (443 if parsed_url.scheme == "https" else 80))
    except (ValueError, UnsafeTarget) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    scan = Scan(user_id=user.id, url=payload.website, normalized_url=normalized, status="PENDING_PAYMENT")
    session.add(scan)
    await session.flush()
    session.add(AuditLog(user_id=user.id, action="SCAN_CREATED", resource="scan", resource_id=str(scan.id), metadata_json={"host": normalized.split("/", 3)[2]}))
    await session.commit()
    await session.refresh(scan)
    return present_scan(scan)


@router.get("/scans/{scan_id}", response_model=ScanDetails)
async def get_scan(scan_id: UUID, user: User = Depends(authenticated_user), session: AsyncSession = Depends(get_session)) -> ScanDetails:
    scan = await session.scalar(select(Scan).where(Scan.id == scan_id, Scan.user_id == user.id).options(selectinload(Scan.evidence)))
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return ScanDetails(**present_scan(scan).model_dump(), evidence=scan.evidence)


@router.get("/scans/{scan_id}/status", response_model=ScanStatus)
async def get_scan_status(scan_id: UUID, user: User = Depends(authenticated_user), session: AsyncSession = Depends(get_session)) -> ScanStatus:
    scan = await session.scalar(select(Scan).where(Scan.id == scan_id, Scan.user_id == user.id))
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return present_scan(scan)


@router.post("/payments/initialize/{scan_id}", response_model=PaymentInitialized)
async def create_checkout(scan_id: UUID, payload: ScanPaymentCreate, user: User = Depends(authenticated_user), session: AsyncSession = Depends(get_session)) -> PaymentInitialized:
    scan = await session.scalar(select(Scan).where(Scan.id == scan_id, Scan.user_id == user.id).with_for_update())
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")
    try:
        checkout = await initialize_payment(session, scan, user.email, user.id, payload.phone)
    except PaymentError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return PaymentInitialized(**checkout)


@router.post("/consultations/checkout", response_model=ConsultationCheckout, status_code=status.HTTP_201_CREATED)
async def create_consultation_checkout(payload: ConsultationCreate, session: AsyncSession = Depends(get_session)) -> ConsultationCheckout:
    try:
        checkout = await initialize_consultation_payment(session, str(payload.email).strip().lower(), payload.phone, payload.question.strip())
    except PaymentError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return ConsultationCheckout(**checkout)


@router.get("/consultations/payment/{reference}", response_model=ConsultationPaymentStatus)
async def get_consultation_payment_status(reference: str, session: AsyncSession = Depends(get_session)) -> ConsultationPaymentStatus:
    try:
        consultation = await verify_consultation_payment(session, reference)
    except PaymentError as error:
        message = str(error)
        code = status.HTTP_404_NOT_FOUND if "not created by this service" in message else status.HTTP_503_SERVICE_UNAVAILABLE
        raise HTTPException(status_code=code, detail=message) from error
    return ConsultationPaymentStatus(reference=consultation.payment_reference, status=consultation.status)


@router.post("/payments/webhook")
async def paystack_webhook(request: Request, background_tasks: BackgroundTasks, session: AsyncSession = Depends(get_session)) -> dict[str, bool]:
    raw_body = await request.body()
    signature = request.headers.get("x-paystack-signature")
    if not verify_webhook_signature(raw_body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")
    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid webhook payload.") from error
    if event.get("event") != "charge.success":
        return {"received": True}
    reference = (event.get("data") or {}).get("reference")
    if not reference:
        raise HTTPException(status_code=400, detail="Webhook did not include a transaction reference.")
    payment = await session.scalar(select(Payment).where(Payment.reference == reference))
    if payment is None:
        consultation = await session.scalar(select(Consultation).where(Consultation.payment_reference == reference))
        if consultation is None:
            raise HTTPException(status_code=404, detail="Payment reference not found.")
        try:
            await verify_consultation_payment(session, reference)
        except (PaymentError, ValueError) as error:
            raise HTTPException(status_code=400, detail="Paystack consultation payment verification failed.") from error
        return {"received": True}
    try:
        payment = await verify_payment(session, reference, payment.scan_id)
        await queue_paid_scan(payment.scan_id, background_tasks, session)
    except (PaymentError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Paystack transaction verification failed.") from error
    return {"received": True}


@router.get("/payments/{reference}", response_model=PaymentStatus)
async def payment_status(reference: str, background_tasks: BackgroundTasks, user: User = Depends(authenticated_user), session: AsyncSession = Depends(get_session)) -> PaymentStatus:
    payment = await session.scalar(select(Payment).where(Payment.reference == reference, Payment.user_id == user.id))
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found.")
    if payment.status != "PAID":
        try:
            await verify_payment(session, reference)
        except (PaymentError, ValueError):
            pass
        await session.refresh(payment)
    await queue_paid_scan(payment.scan_id, background_tasks, session)
    return PaymentStatus(reference=payment.reference, status=payment.status, scan_id=payment.scan_id)


@router.post("/scans/{scan_id}/analyze", response_model=ScanStatus, status_code=status.HTTP_202_ACCEPTED)
async def start_analysis(scan_id: UUID, background_tasks: BackgroundTasks, user: User = Depends(authenticated_user), session: AsyncSession = Depends(get_session)) -> ScanStatus:
    scan = await session.scalar(select(Scan).where(Scan.id == scan_id, Scan.user_id == user.id).with_for_update())
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")
    if scan.status in {"COMPLETED", "COLLECTING_EVIDENCE", "ANALYZING"}:
        return present_scan(scan)
    if scan.status not in {"QUEUED", "PAID"}:
        raise HTTPException(status_code=409, detail="A verified payment is required before analysis.")
    payment = await session.scalar(select(Payment).where(Payment.scan_id == scan_id, Payment.status == "PAID"))
    if payment is None:
        raise HTTPException(status_code=402, detail="A verified KES 500 payment is required.")
    scan = await queue_paid_scan(scan_id, background_tasks, session)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return present_scan(scan)


async def run_analysis(scan_id: UUID) -> None:
    async with SessionFactory() as session:
        scan = await session.get(Scan, scan_id)
        if scan is None:
            return
        try:
            findings = await inspect_website(scan.normalized_url, session)
            scan.status = "ANALYZING"
            for finding in findings:
                session.add(Evidence(scan_id=scan.id, **finding))
            weights = dict(DEFAULT_WEIGHTS)
            configured = (await session.scalars(select(RiskWeight).where(RiskWeight.enabled.is_(True)))).all()
            if configured:
                weights.update({item.signal: item.points for item in configured})
            observed = {item["signal"] for item in findings}
            mapped = {
                "THREAT_INTELLIGENCE_FLAG": any(name.endswith("_FLAGGED") for name in observed),
                "GUARANTEED_RETURNS": "GUARANTEED_RETURNS" in observed,
                "SUSPICIOUS_WITHDRAWAL_CONDITION": "SUSPICIOUS_WITHDRAWAL_CONDITION" in observed,
                "SUSPICIOUS_PAYMENT_INSTRUCTION": "SUSPICIOUS_PAYMENT_INSTRUCTION" in observed,
                "MISSING_COMPANY_INFORMATION": any(name.startswith("NO_") for name in observed),
            }
            risk = assess_risk([Signal(signal=name, observed=present) for name, present in mapped.items()], weights)
            sources = {item.get("source") for item in findings if item.get("source")}
            unavailable = sum(item.get("value") == "UNAVAILABLE" for item in findings)
            scan.risk_score = risk.score
            scan.risk_level = risk.level
            scan.confidence = assess_confidence(len(sources), sum(item.get("confidence") == "HIGH" for item in findings), True, unavailable)
            scan.ai_summary = await summarize_evidence(scan.normalized_url, risk.score, risk.level, scan.confidence, findings)
            scan.status = "COMPLETED"
            from app.models import utc_now

            scan.completed_at = utc_now()
            session.add(AuditLog(action="SCAN_COMPLETED", resource="scan", resource_id=str(scan.id), metadata_json={"risk_score": risk.score, "risk_level": risk.level}))
            await session.commit()
        except (UnsafeTarget, ValueError) as error:
            scan.status = "FAILED"
            scan.ai_summary = str(error)
            await session.commit()
        except Exception:
            scan.status = "FAILED"
            scan.ai_summary = "Analysis could not be completed. No risk conclusion was produced."
            await session.commit()
