import base64
import socket
import ssl
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol
from urllib.parse import quote

import httpx
import tldextract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models import RDAPLookupCache
from app.services.url_safety import resolve_public_addresses


@dataclass(frozen=True)
class ProviderFinding:
    provider: str
    status: str
    summary: str
    source_url: str | None = None
    checked_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class ReputationProvider(Protocol):
    async def check_url(self, url: str) -> ProviderFinding: ...


class VirusTotalProvider:
    name = "VirusTotal"

    async def check_url(self, url: str) -> ProviderFinding:
        if not settings.virustotal_api_key:
            return ProviderFinding(self.name, "UNAVAILABLE", "Provider credentials are not configured.")
        url_id = base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")
        endpoint = f"https://www.virustotal.com/api/v3/urls/{url_id}"
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            response = await client.get(endpoint, headers={"x-apikey": settings.virustotal_api_key})
        if response.status_code == 404:
            return ProviderFinding(self.name, "UNKNOWN", "URL is not present in the provider report.", endpoint)
        response.raise_for_status()
        stats = response.json().get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
        malicious = int(stats.get("malicious", 0)) + int(stats.get("suspicious", 0))
        status = "FLAGGED" if malicious else "SAFE"
        return ProviderFinding(self.name, status, f"{malicious} vendor detections reported.", endpoint)


class SafeBrowsingProvider:
    name = "Google Safe Browsing"

    async def check_url(self, url: str) -> ProviderFinding:
        if not settings.google_safe_browsing_api_key:
            return ProviderFinding(self.name, "UNAVAILABLE", "Provider credentials are not configured.")
        endpoint = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
        payload = {"client": {"clientId": "trade-shield-africa", "clientVersion": "0.1"}, "threatInfo": {"threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"], "platformTypes": ["ANY_PLATFORM"], "threatEntryTypes": ["URL"], "threatEntries": [{"url": url}]}}
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            response = await client.post(endpoint, params={"key": settings.google_safe_browsing_api_key}, json=payload)
        response.raise_for_status()
        matches = response.json().get("matches", [])
        return ProviderFinding(self.name, "FLAGGED" if matches else "SAFE", f"{len(matches)} threat matches reported.", endpoint)


class RDAPProvider:
    name = "RDAP"
    _extract_domain = tldextract.TLDExtract(suffix_list_urls=())

    async def lookup_domain(self, domain: str, session: AsyncSession) -> ProviderFinding:
        extracted = self._extract_domain(domain.lower().rstrip("."))
        registered_domain = extracted.top_domain_under_public_suffix or domain.lower().rstrip(".")
        cached = await session.get(RDAPLookupCache, registered_domain)
        if cached is not None:
            return ProviderFinding(self.name, cached.status, cached.summary, cached.source_url, cached.checked_at)

        endpoint = f"https://rdap.org/domain/{quote(registered_domain, safe='.-')}"
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            response = await client.get(endpoint, headers={"Accept": "application/rdap+json"})
        if response.status_code == 404:
            finding = ProviderFinding(self.name, "UNKNOWN", "No RDAP record was returned.", endpoint)
            session.add(RDAPLookupCache(domain=registered_domain, status=finding.status, summary=finding.summary, source_url=endpoint, checked_at=finding.checked_at))
            await session.commit()
            return finding
        response.raise_for_status()
        data = response.json()
        registration = next((event.get("eventDate") for event in data.get("events", []) if event.get("eventAction") == "registration"), None)
        registrar = next((entity.get("vcardArray", [None, []])[1][0][3] for entity in data.get("entities", []) if "registrar" in entity.get("roles", []) and entity.get("vcardArray", [None, []])[1]), None)
        age_text = "registration date not provided"
        if registration:
            registered_at = datetime.fromisoformat(registration.replace("Z", "+00:00"))
            if registered_at.tzinfo is None:
                registered_at = registered_at.replace(tzinfo=timezone.utc)
            age_days = max((datetime.now(timezone.utc) - registered_at).days, 0)
            age_text = f"registered {registered_at.date().isoformat()} (approximately {age_days} days old)"
        summary = f"Domain {age_text}; registrar: {registrar or 'not provided'}."
        finding = ProviderFinding(self.name, "FOUND", summary, endpoint)
        session.add(RDAPLookupCache(
            domain=registered_domain,
            status=finding.status,
            summary=finding.summary,
            source_url=endpoint,
            registration_date=registration,
            registrar=registrar,
            checked_at=finding.checked_at,
        ))
        await session.commit()
        return finding


class DNSProvider:
    name = "DNS"

    async def lookup(self, domain: str) -> ProviderFinding:
        try:
            records = await __import__("asyncio").get_running_loop().getaddrinfo(domain, None, type=socket.SOCK_STREAM)
            addresses = sorted({record[4][0] for record in records})
        except socket.gaierror:
            return ProviderFinding(self.name, "UNKNOWN", "The domain did not resolve to an address.")
        return ProviderFinding(self.name, "FOUND", f"Resolved addresses: {', '.join(addresses)}.")


class SSLProvider:
    name = "TLS"

    async def inspect(self, domain: str, port: int = 443) -> ProviderFinding:
        import asyncio

        try:
            addresses = await resolve_public_addresses(domain, port)
            address = addresses[0]
            context = ssl.create_default_context()
            reader, writer = await asyncio.wait_for(asyncio.open_connection(address, port, ssl=context, server_hostname=domain), timeout=5)
            certificate = writer.get_extra_info("peercert") or {}
            writer.close()
            await writer.wait_closed()
            return ProviderFinding(self.name, "VALID", f"TLS certificate validated for {domain}; expires {certificate.get('notAfter', 'date unavailable')}.")
        except (OSError, ssl.SSLError, TimeoutError, ValueError) as error:
            return ProviderFinding(self.name, "INVALID", f"TLS could not be validated: {type(error).__name__}.")


class RegulatoryProvider(Protocol):
    async def verify_claim(self, entity_name: str, license_number: str | None, service_category: str | None) -> ProviderFinding: ...


class PublicRegisterProvider:
    """Conservative default until an official, maintained register feed is configured."""

    async def verify_claim(self, entity_name: str, license_number: str | None, service_category: str | None) -> ProviderFinding:
        return ProviderFinding("African regulator public registers", "NOT_VERIFIED", "No authoritative register feed is configured; absence of a match is not evidence of fraud.")
