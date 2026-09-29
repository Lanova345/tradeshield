from datetime import datetime
import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    password: str = Field(min_length=12, max_length=128)


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class AdminLoginInput(BaseModel):
    username: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=12, max_length=128)


class AuthResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str


class ScanCreate(BaseModel):
    website: str = Field(min_length=3, max_length=2048)


class ScanStatus(BaseModel):
    id: UUID
    website: str
    status: str
    risk_score: int | None = None
    risk_level: str | None = None
    confidence: str | None = None
    summary: str | None = None
    created_at: datetime


class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category: str
    signal: str
    severity: str
    value: str | None
    description: str
    source: str | None
    source_url: str | None
    confidence: str
    observed_at: datetime


class ScanDetails(ScanStatus):
    evidence: list[EvidenceResponse] = Field(default_factory=list)


class PaymentInitialized(BaseModel):
    reference: str
    status: str
    display_text: str


class PaymentStatus(BaseModel):
    reference: str
    status: str
    scan_id: UUID


class ConsultationCreate(BaseModel):
    email: EmailStr
    phone: str = Field(min_length=9, max_length=24)
    question: str = Field(min_length=15, max_length=5000)

    @field_validator("phone")
    @classmethod
    def normalize_mpesa_phone(cls, value: str) -> str:
        return normalize_mpesa_phone(value)


class ScanPaymentCreate(BaseModel):
    phone: str = Field(min_length=9, max_length=24)

    @field_validator("phone")
    @classmethod
    def validate_mpesa_phone(cls, value: str) -> str:
        return normalize_mpesa_phone(value)


def normalize_mpesa_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 9 and digits[0] in {"1", "7"}:
        digits = f"254{digits}"
    elif len(digits) == 10 and digits.startswith("0"):
        digits = f"254{digits[1:]}"
    if not re.fullmatch(r"254[17]\d{8}", digits):
        raise ValueError("Enter a valid Kenyan M-Pesa phone number.")
    return f"+{digits}"

class ConsultationCheckout(BaseModel):
    reference: str
    status: str
    display_text: str


class ConsultationPaymentStatus(BaseModel):
    reference: str
    status: str


class SiteReportCreate(BaseModel):
    website_url: str = Field(min_length=3, max_length=2048)
    message: str = Field(min_length=20, max_length=5000)


class SiteReportReview(BaseModel):
    notes: str | None = Field(default=None, max_length=5000)


class SiteReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    website_url: str
    message: str
    status: str
    review_notes: str | None
    submitted_at: datetime
    reviewed_at: datetime | None


class NewsArticleCreate(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    site_url: str | None = Field(default=None, max_length=2048)
    summary: str = Field(min_length=20, max_length=1000)
    content: str = Field(min_length=50, max_length=20000)
    source_urls: list[str] = Field(default_factory=list, max_length=12)


class ReportArticleCreate(NewsArticleCreate):
    confirm_sources_reviewed: bool


class ArticlePublishConfirmation(BaseModel):
    confirm_sources_reviewed: bool


class NewsArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    report_id: UUID | None
    title: str
    slug: str
    site_url: str | None
    summary: str
    content: str
    source_urls: list[str]
    status: str
    created_at: datetime
    published_at: datetime | None


class PublicNewsArticle(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    slug: str
    site_url: str | None
    summary: str
    content: str
    source_urls: list[str]
    published_at: datetime
