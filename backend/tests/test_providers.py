import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import Base, RDAPLookupCache
from app.services.providers import RDAPProvider


@pytest.mark.asyncio
async def test_rdap_lookup_caches_by_registered_domain_and_reports_domain_age(monkeypatch) -> None:
    import app.services.providers as providers

    class Response:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "events": [{"eventAction": "registration", "eventDate": "2020-01-02T00:00:00Z"}],
                "entities": [{"roles": ["registrar"], "vcardArray": ["vcard", [["fn", {}, "text", "Example Registrar"]]]}],
            }

    class FakeClient:
        requests = []

        def __init__(self, **_options):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url, *, headers):
            type(self).requests.append((url, headers))
            return Response()

    monkeypatch.setattr(providers.httpx, "AsyncClient", FakeClient)
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    provider = RDAPProvider()

    async with session_factory() as first_session:
        first = await provider.lookup_domain("www.example.co.ke", first_session)
    async with session_factory() as second_session:
        second = await provider.lookup_domain("shop.example.co.ke", second_session)

    async with session_factory() as verification_session:
        cached = await verification_session.get(RDAPLookupCache, "example.co.ke")
    await engine.dispose()

    assert isinstance(cached, RDAPLookupCache)
    assert len(FakeClient.requests) == 1
    assert FakeClient.requests[0][0] == "https://rdap.org/domain/example.co.ke"
    assert "2020-01-02" in first.summary
    assert "days old" in first.summary
    assert "Example Registrar" in first.summary
    assert second.summary == first.summary
    assert second.checked_at == cached.checked_at


@pytest.mark.asyncio
async def test_rdap_not_found_response_is_cached(monkeypatch) -> None:
    import app.services.providers as providers

    class Response:
        status_code = 404

    class FakeClient:
        requests = 0

        def __init__(self, **_options):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, *_args, **_kwargs):
            type(self).requests += 1
            return Response()

    monkeypatch.setattr(providers.httpx, "AsyncClient", FakeClient)
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    provider = RDAPProvider()

    async with session_factory() as first_session:
        first = await provider.lookup_domain("missing.example", first_session)
    async with session_factory() as second_session:
        second = await provider.lookup_domain("missing.example", second_session)
    await engine.dispose()

    assert first.status == second.status == "UNKNOWN"
    assert FakeClient.requests == 1
