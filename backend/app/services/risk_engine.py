from dataclasses import dataclass


DEFAULT_WEIGHTS = {
    "REGULATORY_WARNING": 30,
    "THREAT_INTELLIGENCE_FLAG": 30,
    "VERIFIED_MALWARE_OR_PHISHING": 30,
    "REGULATORY_IDENTITY_MISMATCH": 20,
    "SUSPICIOUS_PAYMENT_INSTRUCTION": 15,
    "GUARANTEED_RETURNS": 15,
    "RECENT_DOMAIN": 10,
    "MISSING_COMPANY_INFORMATION": 10,
    "SUSPICIOUS_WITHDRAWAL_CONDITION": 20,
    "CONTRADICTORY_IDENTITIES": 15,
}


@dataclass(frozen=True)
class Signal:
    signal: str
    observed: bool
    severity: str = "MEDIUM"


@dataclass(frozen=True)
class RiskAssessment:
    score: int
    level: str


def assess_risk(signals: list[Signal], weights: dict[str, int] | None = None) -> RiskAssessment:
    configured = weights or DEFAULT_WEIGHTS
    points = sum(max(0, configured.get(signal.signal, 0)) for signal in signals if signal.observed)
    score = min(100, points)
    if score >= 75:
        level = "CRITICAL"
    elif score >= 50:
        level = "HIGH"
    elif score >= 30:
        level = "MODERATE"
    else:
        level = "LOW"
    return RiskAssessment(score=score, level=level)


def assess_confidence(independent_sources: int, high_reliability_sources: int, evidence_fresh: bool, unavailable_critical_sources: int) -> str:
    points = min(independent_sources, 5) * 10 + min(high_reliability_sources, 3) * 10
    points += 20 if evidence_fresh else 0
    points -= min(unavailable_critical_sources, 3) * 15
    if points >= 70:
        return "HIGH"
    if points >= 40:
        return "MEDIUM"
    return "LOW"
