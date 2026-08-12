"""OpenAI Responses API provider with structured output + retries."""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any, cast

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic import ValidationError

from app.agents.prompts import SYSTEM_PROMPT
from app.agents.result import AgentRunResult
from app.agents.schemas import AgentStructuredOutput
from app.agents.tools import normalize_extracted_fields
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class OpenAIProviderError(Exception):
    """Raised when OpenAI call fails after retries and caller should fallback."""


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


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, (APITimeoutError, APIConnectionError, RateLimitError)):
        return True
    if isinstance(exc, APIStatusError):
        status = getattr(exc, "status_code", None) or getattr(
            getattr(exc, "response", None), "status_code", None
        )
        return status is not None and int(status) >= 500
    return False


async def _parse_once(
    *,
    client: AsyncOpenAI,
    model: str,
    temperature: float,
    model_input: list[dict[str, Any]],
) -> Any:
    return await client.responses.parse(
        model=model,
        temperature=temperature,
        instructions=SYSTEM_PROMPT,
        input=cast(Any, model_input),
        text_format=AgentStructuredOutput,
    )


def _to_structured(response: Any) -> AgentStructuredOutput:
    parsed = getattr(response, "output_parsed", None)
    if parsed is None:
        raw_text = getattr(response, "output_text", None) or ""
        try:
            parsed = AgentStructuredOutput.model_validate(json.loads(raw_text))
        except (ValidationError, json.JSONDecodeError, TypeError) as exc:
            raise OpenAIProviderError("Invalid structured output") from exc
    if not isinstance(parsed, AgentStructuredOutput):
        try:
            parsed = AgentStructuredOutput.model_validate(parsed)
        except ValidationError as exc:
            raise OpenAIProviderError("Invalid structured output") from exc
    return parsed


async def call_openai_structured(
    *,
    model_input: list[dict[str, Any]],
) -> AgentRunResult:
    settings = get_settings()
    if not settings.openai_api_key:
        raise OpenAIProviderError("OPENAI_API_KEY is not configured")

    client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=float(settings.ai_timeout_seconds),
        max_retries=0,  # we own retry/backoff
    )

    max_retries = max(0, int(settings.ai_max_retries))
    started = time.perf_counter()
    last_error: BaseException | None = None
    attempts = 0

    for attempt in range(max_retries + 1):
        attempts = attempt
        try:
            response = await _parse_once(
                client=client,
                model=settings.openai_model,
                temperature=settings.ai_temperature,
                model_input=model_input,
            )
            parsed = _to_structured(response)
            latency_ms = (time.perf_counter() - started) * 1000
            inp, out, total = _usage_tokens(response)
            extracted = normalize_extracted_fields(
                parsed.extracted_fields.model_dump(exclude_none=True)
            )
            return AgentRunResult(
                reply=parsed.response,
                intent=parsed.intent,
                language=parsed.language,
                confidence=parsed.confidence,
                requires_human=parsed.requires_human
                or parsed.recommended_action.upper() == "HUMAN_HANDOFF"
                or parsed.intent == "handoff",
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
        except OpenAIProviderError as exc:
            # Invalid structured output: retry then fail
            last_error = exc
            logger.warning(
                "openai_invalid_or_provider_error",
                attempt=attempt,
                max_retries=max_retries,
                detail=str(exc)[:300],
            )
        except (APITimeoutError, APIConnectionError, RateLimitError, APIStatusError) as exc:
            last_error = exc
            logger.warning(
                "openai_call_failed",
                attempt=attempt,
                max_retries=max_retries,
                error_type=type(exc).__name__,
                detail=str(exc)[:300],
                model=settings.openai_model,
            )
            if not _is_retryable(exc) and not isinstance(
                exc, (APITimeoutError, APIConnectionError, RateLimitError)
            ):
                # non-5xx APIStatusError → no retry
                if isinstance(exc, APIStatusError) and not _is_retryable(exc):
                    break
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning(
                "openai_call_unexpected",
                attempt=attempt,
                error_type=type(exc).__name__,
                detail=str(exc)[:300],
            )
            break

        if attempt < max_retries:
            delay = 0.4 * (2**attempt)
            await asyncio.sleep(delay)

    raise OpenAIProviderError(
        f"OpenAI failed after {attempts + 1} attempt(s): {last_error}"
    ) from last_error
