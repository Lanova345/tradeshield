import asyncio
import ipaddress
import socket
from urllib.parse import urljoin, urlsplit

import aiohttp
from aiohttp.abc import AbstractResolver


MAX_RESPONSE_BYTES = 2_000_000
MAX_REDIRECTS = 4
TIMEOUT_SECONDS = 8


class UnsafeTarget(ValueError):
    pass


def normalize_url(value: str) -> str:
    candidate = value.strip()
    if not candidate:
        raise ValueError("Website address is required.")
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    parsed = urlsplit(candidate)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only HTTP and HTTPS websites are supported.")
    if not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Enter a valid website address without embedded credentials.")
    if parsed.port not in (None, 80, 443):
        raise ValueError("Only standard HTTP and HTTPS ports are supported.")
    if parsed.hostname.endswith("."):
        hostname = parsed.hostname[:-1]
        parsed = parsed._replace(netloc=hostname + (f":{parsed.port}" if parsed.port else ""))
    return parsed.geturl()


async def resolve_public_addresses(hostname: str, port: int) -> list[str]:
    lowered = hostname.lower().rstrip(".")
    if lowered in {"localhost", "metadata.google.internal"} or lowered.endswith((".localhost", ".local", ".internal")):
        raise UnsafeTarget("Local and internal hostnames are not allowed.")
    try:
        literal_ip = ipaddress.ip_address(lowered)
        addresses = [str(literal_ip)]
    except ValueError:
        loop = asyncio.get_running_loop()
        try:
            records = await loop.getaddrinfo(lowered, port, type=socket.SOCK_STREAM)
        except socket.gaierror as error:
            raise UnsafeTarget("The website hostname could not be resolved.") from error
        addresses = list(dict.fromkeys(record[4][0] for record in records))
    if not addresses:
        raise UnsafeTarget("The website hostname has no address records.")
    for address in addresses:
        parsed_ip = ipaddress.ip_address(address.split("%", maxsplit=1)[0])
        if not parsed_ip.is_global:
            raise UnsafeTarget("Websites resolving to private or reserved network addresses are not allowed.")
    return addresses


class PinnedResolver(AbstractResolver):
    def __init__(self, hostname: str, addresses: list[str]):
        self.hostname = hostname
        self.addresses = addresses

    async def resolve(self, host: str, port: int = 0, family: int = socket.AF_INET) -> list[dict]:
        if host.lower().rstrip(".") != self.hostname.lower().rstrip("."):
            raise UnsafeTarget("Redirect host was not validated.")
        results = []
        for address in self.addresses:
            parsed_ip = ipaddress.ip_address(address)
            address_family = socket.AF_INET6 if parsed_ip.version == 6 else socket.AF_INET
            results.append({"hostname": host, "host": address, "port": port, "family": address_family, "proto": 0, "flags": 0})
        return results

    async def close(self) -> None:
        return None


async def fetch_public_page(value: str) -> dict:
    current_url = normalize_url(value)
    timeout = aiohttp.ClientTimeout(total=TIMEOUT_SECONDS, connect=4, sock_read=4)
    for redirect_number in range(MAX_REDIRECTS + 1):
        parsed = urlsplit(current_url)
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        addresses = await resolve_public_addresses(parsed.hostname or "", port)
        resolver = PinnedResolver(parsed.hostname or "", addresses)
        connector = aiohttp.TCPConnector(resolver=resolver, use_dns_cache=False, limit=1)
        async with aiohttp.ClientSession(timeout=timeout, connector=connector, trust_env=False, auto_decompress=False) as session:
            async with session.get(current_url, allow_redirects=False, headers={"User-Agent": "TradeShieldResearch/1.0", "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1"}) as response:
                if response.status in {301, 302, 303, 307, 308}:
                    location = response.headers.get("Location")
                    if not location or redirect_number >= MAX_REDIRECTS:
                        raise UnsafeTarget("Redirect limit exceeded or redirect destination missing.")
                    current_url = normalize_url(urljoin(current_url, location))
                    continue
                body = bytearray()
                async for chunk in response.content.iter_chunked(16_384):
                    body.extend(chunk)
                    if len(body) > MAX_RESPONSE_BYTES:
                        raise UnsafeTarget("Website response exceeded the size limit.")
                return {"url": current_url, "status": response.status, "headers": dict(response.headers), "body": bytes(body), "content_type": response.headers.get("Content-Type", "")}
    raise UnsafeTarget("Redirect limit exceeded.")
