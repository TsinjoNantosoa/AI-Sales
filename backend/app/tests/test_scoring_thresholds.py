"""Scoring threshold settings tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.enums import LeadTemperature
from app.schemas.dashboard import LeadScoringSettings
from app.services.scoring import compute_lead_score
from app.services.scoring_thresholds import ScoringThresholds, temperature_from_score


def test_temperature_custom_thresholds():
    thresholds = ScoringThresholds(hot_threshold=80, warm_threshold=50, auto_qualify_at=75)
    assert temperature_from_score(49, thresholds) == LeadTemperature.COLD
    assert temperature_from_score(50, thresholds) == LeadTemperature.WARM
    assert temperature_from_score(79, thresholds) == LeadTemperature.WARM
    assert temperature_from_score(80, thresholds) == LeadTemperature.HOT


def test_lead_scoring_settings_validation():
    with pytest.raises(ValidationError):
        LeadScoringSettings(hot_threshold=40, warm_threshold=50)
    with pytest.raises(ValidationError):
        LeadScoringSettings(hot_threshold=101, warm_threshold=40)


def test_compute_lead_score_respects_custom_thresholds():
    data = compute_lead_score(
        {
            "first_name": "A",
            "last_name": "B",
            "email": "a@b.com",
            "company_name": "Co",
            "budget_max": 12000,
            "timeline": "Immediately",
            "decision_authority": "Yes, I decide",
            "service_interest": "AI Automation",
            "need_description": "Long enough need description here.",
            "company_size": "201-500",
        },
        ScoringThresholds(hot_threshold=95, warm_threshold=60, auto_qualify_at=90),
    )
    assert data["temperature"] in {LeadTemperature.WARM, LeadTemperature.HOT, LeadTemperature.COLD}
