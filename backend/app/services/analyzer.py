import asyncio
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit

from app.services.providers import DNSProvider, RDAPProvider, ReputationProvider, SafeBrowsingProvider, SSLProvider, VirusTotalProvider
from app.services.url_safety import fetch_public_page
from sqlalchemy.ext.asyncio import AsyncSession


PATTERNS = {
    "GUARANTEED_RETURNS": (re.compile(r"\b(guaranteed?|risk[- ]free)\s+(profit|return|income|investment)s?\b", re.I), "Guaranteed-return language can be a warning indicator and should be independently verified."),
    "SUSPICIOUS_WITHDRAWAL_CONDITION": (re.compile(r"(tax|unlock|release|activation|verification)\s+(fee|deposit|payment).{0,80}(withdraw|release|unlock|payout)", re.I), "An advance payment demand associated with a withdrawal warrants independent verification."),
    "SUSPICIOUS_PAYMENT_INSTRUCTION": (re.compile(r"(send|pay|deposit|transfer).{0,80}(personal account|individual account|crypto wallet|bitcoin|usdt|mpesa|m-pesa)", re.I), "The website describes a potentially unusual payment route; ownership and instructions were not verified."),
    "URGENT_DEPOSIT_PRESSURE": (re.compile(r"(deposit|invest|pay).{0,50}(today|now|within\s+\d+\s+hours|limited time)", re.I), "Time-pressured deposit language can increase risk and should be reviewed in context."),
}


class PageTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.links: list[str] = []
        self.metadata: dict[str, str] = {}
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1
        if tag == "meta" and attributes.get("name", "").lower() in {"description", "author"}:
            self.metadata[attributes["name"].lower()] = attributes.get("content", "") or ""
        if tag == "a" and attributes.get("href"):
            self.links.append(attributes["href"] or "")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._skip_depth and data.strip():
            self.parts.append(data.strip())


async def inspect_website(url: str, session: AsyncSession) -> list[dict[str, str | None]]:
    page = await fetch_public_page(url)
    parsed_url = urlsplit(page["url"])
    parser = PageTextParser()
    if "html" in page["content_type"].lower():
        parser.feed(page["body"].decode("utf-8", errors="replace"))
    text = " ".join(parser.parts)
    findings: list[dict[str, str | None]] = []

    def add(category: str, signal: str, severity: str, description: str, value: str | None = None, source: str | None = "Trade Shield technical analysis", source_url: str | None = page["url"], confidence: str = "MEDIUM") -> None:
        findings.append({"category": category, "signal": signal, "severity": severity, "description": description, "value": value, "source": source, "source_url": source_url, "confidence": confidence})

    add("TECHNICAL", "HTTP_STATUS", "INFO", f"Website returned HTTP {page['status']}.", str(page["status"]))
    add("TECHNICAL", "HTTPS_ENABLED", "INFO" if parsed_url.scheme == "https" else "MEDIUM", f"HTTPS is {'enabled' if parsed_url.scheme == 'https' else 'not enabled'} for the final website URL.", parsed_url.scheme.upper())
    security_headers = {"strict-transport-security", "content-security-policy", "x-content-type-options", "referrer-policy"}
    present_headers = {header.lower() for header in page["headers"]}
    missing = sorted(security_headers - present_headers)
    if missing:
        add("TECHNICAL", "MISSING_SECURITY_HEADERS", "LOW", "Some common browser security headers were not present; this is a configuration observation, not proof of malicious activity.", ", ".join(missing))
    for signal, (pattern, reason) in PATTERNS.items():
        match = pattern.search(text)
        if match:
            add("CONTENT", signal, "HIGH" if signal in {"GUARANTEED_RETURNS", "SUSPICIOUS_WITHDRAWAL_CONDITION"} else "MEDIUM", reason, match.group(0), confidence="MEDIUM")
    for name in ("privacy", "terms", "contact"):
        if not re.search(rf"\b{name}\b", text, re.I):
            add("IDENTITY", f"NO_{name.upper()}_REFERENCE", "LOW", f"No clear {name} reference was found in the publicly accessible page content.", None, confidence="LOW")
    if parser.metadata.get("description"):
        add("TECHNICAL", "PAGE_DESCRIPTION", "INFO", "A page description was available in metadata.", parser.metadata["description"][:300])

    reputation_providers: list[ReputationProvider] = [VirusTotalProvider(), SafeBrowsingProvider()]
    provider_calls = [provider.check_url(page["url"]) for provider in reputation_providers]
    provider_names = [provider.name for provider in reputation_providers] + ["RDAP", "DNS", "TLS"]
    domain = parsed_url.hostname or ""
    provider_calls.extend([RDAPProvider().lookup_domain(domain, session), DNSProvider().lookup(domain), SSLProvider().inspect(domain)])
    results = await asyncio.gather(*provider_calls, return_exceptions=True)
    for provider_name, result in zip(provider_names, results, strict=True):
        if isinstance(result, BaseException):
            category = "THREAT" if provider_name in {"VirusTotal", "Google Safe Browsing"} else "DOMAIN" if provider_name in {"RDAP", "DNS"} else "TECHNICAL"
            add(category, f"{provider_name.upper().replace(' ', '_')}_UNAVAILABLE", "INFO", "The provider check could not be completed; this is a coverage limitation, not a clean result.", "UNAVAILABLE", provider_name, None, "LOW")
            continue
        category = "THREAT" if result.provider in {"VirusTotal", "Google Safe Browsing"} else "DOMAIN" if result.provider in {"RDAP", "DNS"} else "TECHNICAL"
        severity = "HIGH" if result.status == "FLAGGED" else "INFO" if result.status in {"SAFE", "FOUND", "VALID"} else "LOW"
        value = result.summary if result.provider == "RDAP" else result.status
        add(category, f"{result.provider.upper().replace(' ', '_')}_{result.status}", severity, result.summary, value, result.provider, result.source_url, "HIGH" if result.status in {"FLAGGED", "SAFE", "VALID"} else "LOW")
    return findings
