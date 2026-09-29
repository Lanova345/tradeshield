import pytest

from app.services.url_safety import PinnedResolver, UnsafeTarget, normalize_url, resolve_public_addresses


def test_normalize_url_adds_https_and_rejects_non_web_schemes() -> None:
    assert normalize_url("example.com") == "https://example.com"
    with pytest.raises(ValueError):
        normalize_url("file:///etc/passwd")
    with pytest.raises(ValueError):
        normalize_url("https://user:password@example.com")


@pytest.mark.asyncio
@pytest.mark.parametrize("hostname", ["localhost", "127.0.0.1", "::1", "169.254.169.254", "metadata.google.internal"])
async def test_private_and_metadata_targets_are_rejected(hostname: str) -> None:
    with pytest.raises(UnsafeTarget):
        await resolve_public_addresses(hostname, 443)


@pytest.mark.asyncio
async def test_public_literal_address_is_accepted() -> None:
    assert await resolve_public_addresses("1.1.1.1", 443) == ["1.1.1.1"]


@pytest.mark.asyncio
async def test_pinned_resolver_rejects_unvalidated_redirect_host() -> None:
    resolver = PinnedResolver("example.com", ["1.1.1.1"])
    with pytest.raises(UnsafeTarget):
        await resolver.resolve("attacker.example", 443)
