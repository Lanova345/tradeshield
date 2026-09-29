from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from fastapi import HTTPException, Request, status
from jwt import InvalidTokenError
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import User

password_hasher = PasswordHash.recommended()
TOKEN_COOKIE = "trade_shield_session"
TOKEN_LIFETIME = timedelta(hours=12)


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user.id), "role": user.role, "iat": now, "exp": now + TOKEN_LIFETIME}, settings.jwt_secret_key, algorithm="HS256")


async def current_user(request: Request, session: AsyncSession) -> User:
    token = request.cookies.get(TOKEN_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to access this resource.")
    try:
        claims = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
        user_id = UUID(claims["sub"])
    except (InvalidTokenError, KeyError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is invalid or expired.") from error
    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account was not found.")
    return user


def cookie_options() -> dict[str, object]:
    return {"key": TOKEN_COOKIE, "httponly": True, "secure": settings.app_url.startswith("https://"), "samesite": "lax", "max_age": int(TOKEN_LIFETIME.total_seconds()), "path": "/"}
