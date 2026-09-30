from uuid import uuid4

import pytest
from fastapi import HTTPException, Response

from app.api import get_current_account, logout, register
from app.core.config import settings
from app.models import AuditLog, User
from app.schemas import RegisterInput
from app.services.auth import cookie_options


class FakeSession:
    def __init__(self, existing_user_id=None):
        self.existing_user_id = existing_user_id
        self.items = []
        self.commits = 0

    async def scalar(self, _statement):
        return self.existing_user_id

    def add(self, item):
        self.items.append(item)

    async def flush(self):
        for item in self.items:
            if isinstance(item, User):
                if item.id is None:
                    item.id = uuid4()
                if item.role is None:
                    item.role = "USER"

    async def commit(self):
        self.commits += 1

    async def refresh(self, _item):
        return None

    async def rollback(self):
        return None


@pytest.mark.parametrize(
    ("app_url", "expected_secure", "expected_samesite"),
    [
        ("http://localhost:3000", False, "lax"),
        ("https://tradeshield-zeta.vercel.app", True, "lax"),
    ],
)
def test_cookie_options_match_deployment_origin(monkeypatch, app_url, expected_secure, expected_samesite) -> None:
    monkeypatch.setattr(settings, "app_url", app_url)

    options = cookie_options()

    assert options["secure"] is expected_secure
    assert options["samesite"] == expected_samesite


@pytest.mark.asyncio
async def test_logout_clears_secure_session_cookie(monkeypatch) -> None:
    monkeypatch.setattr(settings, "app_url", "https://tradeshield-zeta.vercel.app")
    response = Response()

    await logout(response)

    set_cookie = response.headers["set-cookie"].lower()
    assert "samesite=lax" in set_cookie
    assert "secure" in set_cookie
    assert "max-age=0" in set_cookie


@pytest.mark.asyncio
async def test_register_hashes_password_sets_session_and_audits_registration() -> None:
    session = FakeSession()
    response = Response()
    payload = RegisterInput(name="Ada Example", email="ADA@example.com", password="a-long-password-123")

    account = await register(payload, response, session)

    user = next(item for item in session.items if isinstance(item, User))
    audit = next(item for item in session.items if isinstance(item, AuditLog))
    assert account.email == "ada@example.com"
    assert user.password_hash != payload.password
    assert audit.user_id == user.id
    assert session.commits == 1
    assert "httponly" in response.headers["set-cookie"].lower()


@pytest.mark.asyncio
async def test_register_rejects_existing_email() -> None:
    session = FakeSession(existing_user_id=uuid4())
    payload = RegisterInput(name="Ada Example", email="ada@example.com", password="a-long-password-123")

    with pytest.raises(HTTPException) as error:
        await register(payload, Response(), session)

    assert error.value.status_code == 409
    assert session.items == []


@pytest.mark.asyncio
async def test_current_account_response_exposes_only_public_account_fields() -> None:
    user = User(id=uuid4(), name="Ada Example", email="ada@example.com", password_hash="not-for-response", role="USER")

    account = await get_current_account(user)

    assert account.email == user.email
    assert not hasattr(account, "password_hash")