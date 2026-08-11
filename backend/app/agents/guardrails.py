"""Guardrails — pricing safety, prompt injection, secret leakage."""

from __future__ import annotations

import re

PRICE_PATTERNS = (
    "exact price",
    "fixed price",
    "quote me",
    "how much exactly",
    "prix exact",
    "tarif exact",
)

INJECTION_PATTERNS = (
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"disregard\s+(all\s+)?(previous|prior)\s+instructions",
    r"reveal\s+(your\s+)?(system\s+)?prompt",
    r"show\s+(me\s+)?(the\s+)?system\s+prompt",
    r"print\s+(your\s+)?instructions",
    r"jailbreak",
    r"DAN\s+mode",
    r"act\s+as\s+(a\s+)?(different|new)\s+system",
    r"ignorez\s+les\s+instructions",
    r"r[ée]v[èe]le(z)?\s+(ton|votre|le)\s+prompt",
)

SECRET_LEAK_PATTERNS = (
    r"api[_ ]?key",
    r"secret[_ ]?key",
    r"jwt[_ ]?secret",
    r"BEGIN\s+PRIVATE\s+KEY",
    r"password\s*=\s*\S+",
    r"sk-[a-zA-Z0-9]{10,}",
)

SQL_OR_DATA_ESCAPE = (
    r"\bselect\b.+\bfrom\b",
    r"\bdrop\s+table\b",
    r"\bunion\s+select\b",
    r"other\s+customers?",
    r"all\s+leads?\b",
    r"database\s+dump",
)


def detect_language(message: str) -> str:
    text = message.lower()
    fr_markers = ("nous", "je suis", "bonjour", "merci", "budget", "entreprise", "sous un", "démarrer", "euros", "€")
    if any(m in text for m in fr_markers) or "œ" in text or "é" in text or "à" in text:
        # Heuristic: French diacritics or common FR phrases
        fr_hits = sum(1 for m in ("nous", "bonjour", "merci", "entreprise", "démarrer", "euros", "souhaite", "voulons") if m in text)
        if fr_hits >= 1 or "€" in message:
            return "fr"
    return "en"


def is_prompt_injection(message: str) -> bool:
    text = message.lower()
    return any(re.search(p, text, flags=re.I) for p in INJECTION_PATTERNS)


def is_sql_or_data_exfil_attempt(message: str) -> bool:
    text = message.lower()
    return any(re.search(p, text, flags=re.I) for p in SQL_OR_DATA_ESCAPE)


def sanitize_reply(reply: str) -> str:
    banned = ["exactly $", "our price is $", "it costs $", "prix exact", "ça coûte exactement"]
    lower = reply.lower()
    for b in banned:
        if b in lower:
            return PRICING_SAFE_REPLY_EN
    # Strip accidental secret-like tokens from model output
    cleaned = reply
    for pat in SECRET_LEAK_PATTERNS:
        cleaned = re.sub(pat, "[redacted]", cleaned, flags=re.I)
    return cleaned


def should_refuse_price_invention(message: str) -> bool:
    lower = message.lower()
    return any(p in lower for p in PRICE_PATTERNS)


PRICING_SAFE_REPLY_EN = (
    "Pricing depends on your use case and scope. "
    "I can't quote an exact price here — "
    "I can connect you with a specialist for a tailored estimate, "
    "or we can book a short discovery call."
)

PRICING_SAFE_REPLY_FR = (
    "Le tarif dépend de votre besoin et du périmètre. "
    "Je ne peux pas avancer un prix exact ici — "
    "je peux vous mettre en relation avec un spécialiste "
    "ou réserver un court appel découverte."
)

# Backward-compatible alias
PRICING_SAFE_REPLY = PRICING_SAFE_REPLY_EN

INJECTION_SAFE_REPLY_EN = (
    "I can't change my instructions or share internal configuration. "
    "I can help qualify your project or book a discovery call — what would you like to do?"
)

INJECTION_SAFE_REPLY_FR = (
    "Je ne peux pas modifier mes instructions ni partager de configuration interne. "
    "Je peux vous aider à qualifier votre projet ou réserver un appel — que préférez-vous ?"
)
