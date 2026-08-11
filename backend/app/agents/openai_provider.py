"""OpenAI Responses API provider with structured Pydantic output."""

from __future__ import annotations

import json
import time
from typing import Any

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic import ValidationError

from app.agents.prompts import SYSTEM_PROMPT, build_user_context_block
from app.agents.result import AgentRunResult
from app.agents.schemas import AgentStructuredOutput
from app.agents.tools import lead_known_profile, normalize_extracted_fields
from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.lead import Lead

logger = get_logger(__name__)


class OpenAIProviderError(Exception):
    """Raised when OpenAI call fails and caller should fallback."""


def _usage_tokens(response: Any) -> tuple[int | None, int | None, int | None]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return None, None, None
    inp = getattr(usage, "input_tokens", None)
    out = getattr(usage, "output_tokens", None)
    total = getattr(usage, "total_tokens", None)
    if total is None and inp is not None and out is not None:
        total = inp + out
    return inp, out, total


async def call_openai_structured(
    *,
    lead: Lead,
    user_message: str,
) -> AgentRunResult:
    settings = get_settings()
    if not settings.openai_api_key:
        raise OpenAIProviderError("OPENAI_API_KEY is not configured")

    client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=float(settings.ai_timeout_seconds),
        max_retries=0,  # we handle fallback ourselves
    )

    lead_summary = lead_known_profile(lead)
    user_block = build_user_context_block(lead_summary=lead_summary, user_message=user_message)

    started = time.perf_counter()
    try:
        response = await client.responses.parse(
            model=settings.openai_model,
            temperature=settings.ai_temperature,
            instructions=SYSTEM_PROMPT,
            input=[
                {
                    "role": "user",
                    "content": user_block,
                }
            ],
            text_format=AgentStructuredOutput,
        )
    except (APITimeoutError, APIConnectionError, RateLimitError, APIStatusError) as exc:
        logger.warning(
            "openai_call_failed",
            error_type=type(exc).__name__,
            detail=str(exc)[:300],
            model=settings.openai_model,
        )
        raise OpenAIProviderError(str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 — network/SDK surprises → fallback
        logger.warning(
            "openai_call_unexpected",
            error_type=type(exc).__name__,
            detail=str(exc)[:300],
            model=settings.openai_model,
        )
        raise OpenAIProviderError(str(exc)) from exc

    latency_ms = (time.perf_counter() - started) * 1000
    parsed = getattr(response, "output_parsed", None)
    if parsed is None:
        # Attempt raw JSON recovery
        raw_text = getattr(response, "output_text", None) or ""
        try:
            parsed = AgentStructuredOutput.model_validate(json.loads(raw_text))
        except (ValidationError, json.JSONDecodeError, TypeError) as exc:
            logger.warning(
                "openai_invalid_structured_output",
                detail=str(exc)[:300],
                raw_preview=str(raw_text)[:200],
            )
            raise OpenAIProviderError("Invalid structured output") from exc

    if not isinstance(parsed, AgentStructuredOutput):
        try:
            parsed = AgentStructuredOutput.model_validate(parsed)
        except ValidationError as exc:
            raise OpenAIProviderError("Invalid structured output") from exc

    inp, out, total = _usage_tokens(response)
    extracted = normalize_extracted_fields(parsed.extracted_fields.model_dump(exclude_none=True))

    return AgentRunResult(
        reply=parsed.response,
        intent=parsed.intent,
        language=parsed.language,
        confidence=parsed.confidence,
        requires_human=parsed.requires_human,
        extracted_fields=extracted,
        missing_fields=list(parsed.missing_fields),
        recommended_action=parsed.recommended_action,
        fallback_used=False,
        model=settings.openai_model,
        response_id=getattr(response, "id", None),
        latency_ms=round(latency_ms, 2),
        input_tokens=inp,
        output_tokens=out,
        total_tokens=total,
    )
