"""Guardrails — never invent prices; escalate sensitive topics."""

from __future__ import annotations

PRICE_PATTERNS = ("exact price", "fixed price", "quote me", "how much exactly")


def sanitize_reply(reply: str) -> str:
    # Strip any invented dollar amounts that look like hard quotes
    banned = ["exactly $", "our price is $", "it costs $"]
    lower = reply.lower()
    for b in banned:
        if b in lower:
            return (
                "I can't quote an exact price here. "
                "Pricing depends on scope — I can help qualify your needs "
                "or book a discovery call with our team."
            )
    return reply


def should_refuse_price_invention(message: str) -> bool:
    lower = message.lower()
    return any(p in lower for p in PRICE_PATTERNS)


PRICING_SAFE_REPLY = (
    "Pricing depends on your use case and scope. "
    "Typical projects range based on complexity — "
    "I can connect you with a specialist for a tailored estimate, "
    "or we can book a short discovery call."
)
