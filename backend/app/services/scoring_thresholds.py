"""Centralized lead scoring thresholds from app settings."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import LeadTemperature
from app.services.settings import DEFAULT_SETTINGS, SettingsService

DEFAULT_HOT_THRESHOLD = 70
DEFAULT_WARM_THRESHOLD = 40
DEFAULT_AUTO_QUALIFY_AT = 70


@dataclass(frozen=True)
class ScoringThresholds:
    hot_threshold: int = DEFAULT_HOT_THRESHOLD
    warm_threshold: int = DEFAULT_WARM_THRESHOLD
    auto_qualify_at: int = DEFAULT_AUTO_QUALIFY_AT


def default_scoring_thresholds() -> ScoringThresholds:
    raw = DEFAULT_SETTINGS["lead_scoring"]
    return ScoringThresholds(
        hot_threshold=int(raw["hot_threshold"]),
        warm_threshold=int(raw["warm_threshold"]),
        auto_qualify_at=int(raw["auto_qualify_at"]),
    )


async def get_scoring_thresholds(db: AsyncSession) -> ScoringThresholds:
    merged = await SettingsService(db)._load_merged()
    raw = merged.get("lead_scoring") or {}
    return ScoringThresholds(
        hot_threshold=int(raw.get("hot_threshold", DEFAULT_HOT_THRESHOLD)),
        warm_threshold=int(raw.get("warm_threshold", DEFAULT_WARM_THRESHOLD)),
        auto_qualify_at=int(raw.get("auto_qualify_at", DEFAULT_AUTO_QUALIFY_AT)),
    )


def temperature_from_score(
    score: int,
    thresholds: ScoringThresholds | None = None,
) -> LeadTemperature:
    t = thresholds or default_scoring_thresholds()
    if score >= t.hot_threshold:
        return LeadTemperature.HOT
    if score >= t.warm_threshold:
        return LeadTemperature.WARM
    return LeadTemperature.COLD
