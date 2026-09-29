from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db import get_session
from app.main import app
from app.models import Base, User
from app.services.auth import hash_password


@pytest_asyncio.fixture
async def api_client(tmp_path) -> AsyncIterator[tuple[AsyncClient, async_sessionmaker]]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'reports-test.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, session_factory
    app.dependency_overrides.pop(get_session, None)
    await engine.dispose()


async def create_account(session_factory, *, email: str, role: str, password: str = "test-password-123") -> None:
    async with session_factory() as session:
        session.add(User(name="Test Admin", email=email, password_hash=hash_password(password), role=role))
        await session.commit()


@pytest.mark.asyncio
async def test_reports_stay_private_until_an_admin_publishes_with_reviewed_sources(api_client) -> None:
    client, session_factory = api_client
    submitted = await client.post(
        "/api/v1/reports",
        json={"website_url": "example.com", "message": "A trading group asked me to deposit more money to unlock a withdrawal."},
    )

    assert submitted.status_code == 201
    report_id = submitted.json()["id"]
    assert submitted.json()["status"] == "PENDING"
    assert (await client.get("/api/v1/news")).json() == []
    assert (await client.get("/api/v1/admin/reports")).status_code == 401

    await create_account(session_factory, email="admin@example.com", role="ADMIN")
    login = await client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "test-password-123"})
    assert login.status_code == 200

    reports = await client.get("/api/v1/admin/reports")
    assert reports.status_code == 200
    assert reports.json()[0]["id"] == report_id

    article = {
        "title": "Review of Example Trading Platform",
        "site_url": "https://example.com",
        "summary": "An evidence-led review of reported withdrawal conditions and public company information.",
        "content": "We reviewed the public claims and available records. These findings describe observed concerns and do not make a legal determination.",
        "source_urls": ["https://example.org/regulator-notice"],
        "confirm_sources_reviewed": True,
    }
    missing_sources = await client.post(
        f"/api/v1/admin/reports/{report_id}/publish",
        json={**article, "source_urls": []},
    )
    unconfirmed_sources = await client.post(
        f"/api/v1/admin/reports/{report_id}/publish",
        json={**article, "confirm_sources_reviewed": False},
    )
    assert missing_sources.status_code == 422
    assert unconfirmed_sources.status_code == 422

    published = await client.post(f"/api/v1/admin/reports/{report_id}/publish", json=article)

    assert published.status_code == 201
    assert published.json()["status"] == "PUBLISHED"
    news = await client.get("/api/v1/news")
    assert len(news.json()) == 1
    assert news.json()[0]["slug"] == published.json()["slug"]


@pytest.mark.asyncio
async def test_non_admin_cannot_view_reports_or_publish_news(api_client) -> None:
    client, session_factory = api_client
    await create_account(session_factory, email="user@example.com", role="USER")
    login = await client.post("/api/v1/auth/login", json={"email": "user@example.com", "password": "test-password-123"})
    assert login.status_code == 200

    assert (await client.get("/api/v1/admin/reports")).status_code == 403
    assert (await client.post("/api/v1/admin/news", json={
        "title": "Test article",
        "summary": "This summary is long enough for validation in this endpoint.",
        "content": "This body is long enough for validation and demonstrates a rejected non-admin publication request.",
        "source_urls": [],
    })).status_code == 403


@pytest.mark.asyncio
async def test_admin_username_login_sets_admin_session(api_client, monkeypatch) -> None:
    client, session_factory = api_client
    admin_password = "admin-login-test-password"
    monkeypatch.setattr(settings, "admin_username", "tradeshield")
    monkeypatch.setattr(settings, "admin_email", "tradeshield-admin@trade-shield.example.com")
    monkeypatch.setattr(settings, "admin_password", SecretStr(admin_password))
    await create_account(session_factory, email=settings.admin_email, role="ADMIN", password=admin_password)

    invalid = await client.post("/api/v1/admin/auth/login", json={"username": "wrong", "password": admin_password})
    valid = await client.post("/api/v1/admin/auth/login", json={"username": "tradeshield", "password": admin_password})

    assert invalid.status_code == 401
    assert valid.status_code == 200
    assert valid.json()["role"] == "ADMIN"
    assert "httponly" in valid.headers["set-cookie"].lower()