"""Lead scoring unit tests (no DB)."""

from __future__ import annotations

from app.core.enums import LeadTemperature
from app.services.scoring import compute_lead_score, parse_budget_range, temperature_from_score
from app.services.scoring_thresholds import ScoringThresholds


def test_temperature_thresholds():
    defaults = ScoringThresholds()
    assert temperature_from_score(10, defaults) == LeadTemperature.COLD
    assert temperature_from_score(40, defaults) == LeadTemperature.WARM
    assert temperature_from_score(70, defaults) == LeadTemperature.HOT
    assert temperature_from_score(100, defaults) == LeadTemperature.HOT


def test_compute_score_hot_profile():
    data = compute_lead_score(
        {
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": "ada@example.com",
            "company_name": "Analytical Engines",
            "phone": "+15551212",
            "country": "UK",
            "service_interest": "AI Automation RAG",
            "need_description": "We need a full qualification chatbot with CRM sync.",
            "budget_max": 12000,
            "timeline": "Immediately",
            "decision_authority": "Yes, I decide",
            "company_size": "201-500",
        }
    )
    assert data["total"] >= 70
    assert data["temperature"] == LeadTemperature.HOT
    assert data["budget_fit"] == 25
    assert data["urgency"] == 20


def test_compute_score_cold_minimal():
    data = compute_lead_score({})
    assert data["total"] < 50
    assert data["temperature"] in {LeadTemperature.COLD, LeadTemperature.WARM}


def test_parse_budget_range():
    assert parse_budget_range("More than $10,000")["budget_min"] == 10000
    assert parse_budget_range("$5,000 – $10,000")["budget_max"] == 10000
    assert parse_budget_range("Less than $1,000")["budget_max"] == 1000
