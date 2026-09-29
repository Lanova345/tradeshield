import json

import httpx

from app.core.config import settings


FALLBACK_SUMMARY = "AI interpretation is not configured. This deterministic score reflects observed signals only; review each source and limitation before acting."


async def summarize_evidence(website: str, risk_score: int, risk_level: str, confidence: str, evidence: list[dict]) -> str:
    if not settings.openai_api_key:
        return FALLBACK_SUMMARY
    system = (
        "You are the cautious explanation layer for a Kenyan digital investment risk assessment. "
        "Use only supplied evidence. Never invent facts, licenses, sources, or conclusions. "
        "Do not change or restate the risk score as your own finding. Never call a company fraudulent or guarantee safety. "
        "Distinguish observed evidence from interpretation, explain uncertainty, and suggest independent verification. "
        "Return a concise plain-language executive summary and 2-4 verification steps."
    )
    payload = {"website": website, "risk_score": risk_score, "risk_level": risk_level, "confidence": confidence, "evidence": evidence}
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={"model": "gpt-4o-mini", "temperature": 0.2, "max_tokens": 650, "messages": [{"role": "system", "content": system}, {"role": "user", "content": json.dumps(payload, ensure_ascii=True)}]},
            )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return content.strip() if isinstance(content, str) and content.strip() else FALLBACK_SUMMARY
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return FALLBACK_SUMMARY
