from app.services.risk_engine import DEFAULT_WEIGHTS, Signal, assess_confidence, assess_risk


def test_risk_score_uses_configured_weights_and_caps_at_100() -> None:
    assessment = assess_risk(
        [Signal("REGULATORY_WARNING", True), Signal("THREAT_INTELLIGENCE_FLAG", True)],
        {**DEFAULT_WEIGHTS, "REGULATORY_WARNING": 45, "THREAT_INTELLIGENCE_FLAG": 70},
    )
    assert assessment.score == 100
    assert assessment.level == "CRITICAL"


def test_risk_thresholds_are_deterministic() -> None:
    assert assess_risk([Signal("REGULATORY_WARNING", True)]).level == "MODERATE"
    assert assess_risk([Signal("REGULATORY_WARNING", True), Signal("RECENT_DOMAIN", True), Signal("MISSING_COMPANY_INFORMATION", True)]).level == "HIGH"
    assert assess_risk([Signal("REGULATORY_WARNING", True), Signal("THREAT_INTELLIGENCE_FLAG", True), Signal("SUSPICIOUS_PAYMENT_INSTRUCTION", True)]).level == "CRITICAL"


def test_unobserved_signals_do_not_change_score() -> None:
    assessment = assess_risk([Signal("REGULATORY_WARNING", False)])
    assert assessment.score == 0
    assert assessment.level == "LOW"


def test_confidence_is_independent_from_risk() -> None:
    assert assess_confidence(1, 0, False, 2) == "LOW"
    assert assess_confidence(4, 2, True, 0) == "HIGH"
