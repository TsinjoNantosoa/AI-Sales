"""Intent detection + field extraction for the deterministic mock agent."""

from __future__ import annotations

import re

INTENTS = (
    "greeting",
    "pricing",
    "book_meeting",
    "qualification",
    "handoff",
    "faq",
    "goodbye",
    "unknown",
)


def detect_intent(message: str) -> str:
    text = message.lower().strip()
    if not text:
        return "unknown"
    if re.search(r"\b(hi|hello|hey|bonjour|salut)\b", text):
        return "greeting"
    if re.search(r"\b(price|pricing|cost|how much|tarif|prix)\b", text) and not re.search(
        r"\bbudget\b", text
    ):
        return "pricing"
    if re.search(r"\b(book|meeting|call|schedule|calendar|rdv|rendez-vous)\b", text):
        return "book_meeting"
    if re.search(
        r"\b(human agent|human specialist|real human|handoff|speak to (a |an )?(human|agent|person)|"
        r"parler (a|à) un (humain|conseiller|agent)|representative)\b",
        text,
    ):
        return "handoff"
    if re.search(r"\b(bye|goodbye|thanks|thank you|merci|au revoir)\b", text):
        return "goodbye"
    if re.search(
        r"\b(lead|automat|crm|integrat|budget|timeline|prospect|pme|personnes?|company|entreprise)\b",
        text,
    ):
        return "qualification"
    if re.search(r"\b(what|how|who|when|where|why|help|service|quoi|comment)\b", text):
        return "faq"
    return "unknown"


def _parse_money(text: str) -> tuple[float | None, float | None]:
    """Extract approximate budget as (min, max) from free text."""
    # $6,000 / $6000 / 5 000 € / 5000 euros
    dollar = re.search(r"\$\s*([\d]{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*k?\b", text, re.I)
    euro = re.search(
        r"([\d]{1,3}(?:[\s\u00a0]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(?:€|euros?)\b",
        text,
        re.I,
    )
    around = re.search(
        r"(?:around|about|environ|d['’]environ|≈|~)\s*\$?\s*([\d,. ]+)\s*(k|€|euros?)?",
        text,
        re.I,
    )

    def to_float(raw: str) -> float | None:
        cleaned = raw.replace("\u00a0", " ").replace(" ", "").replace(",", "")
        try:
            return float(cleaned)
        except ValueError:
            return None

    amount: float | None = None
    if dollar:
        amount = to_float(dollar.group(1).replace(",", ""))
        if amount is not None and dollar.group(0).lower().endswith("k"):
            amount *= 1000
    elif euro:
        amount = to_float(euro.group(1))
    elif around:
        amount = to_float(around.group(1))
        suffix = (around.group(2) or "").lower()
        if amount is not None and suffix == "k":
            amount *= 1000

    if amount is None:
        return None, None
    # Treat as approx max with a soft min
    return max(0.0, amount * 0.8), amount


def _parse_company_size(text: str) -> str | None:
    m = re.search(
        r"\b(\d{1,4})\s*[-–]?\s*(?:person|people|employees?|personnes?|collaborateurs?)\b",
        text,
        re.I,
    )
    if not m:
        m = re.search(r"\b(?:pme|company|entreprise)\s*(?:de|of)?\s*(\d{1,4})\b", text, re.I)
    if not m:
        return None
    n = int(m.group(1))
    if n <= 10:
        return "1–10"
    if n <= 50:
        return "11–50"
    if n <= 200:
        return "51–200"
    if n <= 500:
        return "201–500"
    return "500+"


def extract_fields(message: str) -> dict:
    text = message.lower()
    out: dict = {}

    email = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", message)
    if email:
        out["email"] = email.group(0)
    phone = re.search(r"\+?\d[\d\s().-]{7,}\d", message)
    if phone:
        out["phone"] = phone.group(0)

    if re.search(r"\bimmediately\b|\bimmédiat", text):
        out["timeline"] = "Immediately"
    elif re.search(r"next month|sous un mois|within (a |1 )?month|dans un mois", text):
        out["timeline"] = "Within 30 days"
    elif re.search(r"\b30 days\b|sous 30|within 30", text):
        out["timeline"] = "Within 30 days"
    elif re.search(r"3 months|trois mois|within 3", text):
        out["timeline"] = "Within 3 months"

    bmin, bmax = _parse_money(message)
    if bmax is not None:
        out["budget_min"] = bmin
        out["budget_max"] = bmax
        out["estimated_value"] = bmax

    size = _parse_company_size(message)
    if size:
        out["company_size"] = size

    if re.search(r"ai lead|lead automation|automatiser?\s+(nos\s+)?prospects|ai automation", text):
        out["service_interest"] = "AI Automation"
    elif re.search(r"\bcrm\b", text):
        out["service_interest"] = "CRM Automation"

    if len(message.strip()) > 40 and "need_description" not in out:
        out["need_description"] = message.strip()[:2000]

    return out
