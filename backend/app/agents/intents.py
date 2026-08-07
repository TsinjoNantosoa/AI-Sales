"""Intent detection for mock AI agent."""

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
    if re.search(r"\b(price|pricing|cost|budget|how much|tarif)\b", text):
        return "pricing"
    if re.search(r"\b(book|meeting|call|schedule|calendar|rdv)\b", text):
        return "book_meeting"
    if re.search(r"\b(human|agent|person|handoff|representative)\b", text):
        return "handoff"
    if re.search(r"\b(bye|goodbye|thanks|thank you|merci)\b", text):
        return "goodbye"
    if re.search(r"\b(what|how|who|when|where|why|help|service)\b", text):
        return "faq"
    if re.search(r"\b(lead|automat|crm|integrat|budget|timeline)\b", text):
        return "qualification"
    return "unknown"


def extract_fields(message: str) -> dict:
    text = message.lower()
    out: dict = {}
    email = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", message)
    if email:
        out["email"] = email.group(0)
    phone = re.search(r"\+?\d[\d\s().-]{7,}\d", message)
    if phone:
        out["phone"] = phone.group(0)
    if "immediately" in text:
        out["timeline"] = "Immediately"
    elif "30" in text:
        out["timeline"] = "Within 30 days"
    elif "3 month" in text:
        out["timeline"] = "Within 3 months"
    return out
