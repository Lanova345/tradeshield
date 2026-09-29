from collections.abc import AsyncIterator

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models import Base, User


def async_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return database_url


engine = create_async_engine(async_database_url(settings.database_url), pool_pre_ping=True)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def initialize_database() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    if settings.admin_password is None:
        return

    from app.services.auth import hash_password, verify_password

    admin_email = settings.admin_email.strip().lower()
    admin_password = settings.admin_password.get_secret_value()
    async with SessionFactory() as session:
        user = await session.scalar(select(User).where(func.lower(User.email) == admin_email))
        if user is None:
            user = User(
                name="Trade Shield Admin",
                email=admin_email,
                password_hash=hash_password(admin_password),
                role="ADMIN",
            )
            session.add(user)
        elif user.role != "ADMIN":
            raise RuntimeError("ADMIN_EMAIL is already assigned to a non-admin account; configure a different admin email.")
        elif not verify_password(admin_password, user.password_hash):
            user.password_hash = hash_password(admin_password)
        await session.commit()


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session
