"""Manual live smoke for OpenAI agent (2 real calls).

Usage (from backend/):
  set AI_MOCK_MODE=false
  set RUN_OPENAI_LIVE_TESTS=true
  python -m scripts.live_openai_smoke
"""

from __future__ import annotations

import asyncio
import os
import uuid

from app.agents.graph import run_agent
from app.core.config import get_settings
from app.core.enums import ConversationChannel, ConversationStatus, LeadSource, LeadStatus
from app.models.conversation import Conversation
from app.models.lead import Lead
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

CASES = [
    (
        "en",
        "I run a 20-person consulting company. We need AI lead automation, "
        "our budget is around $6,000 and we want to start next month.",
    ),
    (
        "fr",
        "Nous sommes une PME de 15 personnes. Nous voulons automatiser nos prospects "
        "avec un budget d’environ 5 000 € et démarrer sous un mois.",
    ),
]


async def main() -> None:
    os.environ["AI_MOCK_MODE"] = "false"
    get_settings.cache_clear()
    settings = get_settings()
    if settings.ai_mock_mode:
        raise SystemExit("AI_MOCK_MODE must be false")
    if not settings.openai_api_key:
        raise SystemExit("OPENAI_API_KEY missing")

    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    total_tokens = 0

    async with Session() as session:
        for lang, message in CASES:
            lead = Lead(
                first_name="Smoke",
                last_name=lang.upper(),
                company_name="Smoke Co",
                email=f"smoke.{lang}.{uuid.uuid4().hex[:8]}@example.com",
                country="FR" if lang == "fr" else "US",
                language=lang,
                source=LeadSource.WEBSITE,
                status=LeadStatus.NEW,
                score=0,
                temperature="COLD",
                consent_given=True,
            )
            session.add(lead)
            await session.flush()
            conv = Conversation(
                lead_id=lead.id,
                channel=ConversationChannel.CHATBOT,
                status=ConversationStatus.AI_HANDLED,
            )
            session.add(conv)
            await session.flush()

            result = await run_agent(
                session, conversation=conv, lead=lead, user_message=message
            )
            await session.commit()

            tokens = result.total_tokens or 0
            total_tokens += tokens
            print("=" * 60)
            print(f"lang={lang} model={result.model} fallback={result.fallback_used}")
            print(f"response_id={result.response_id} tokens={tokens} latency_ms={result.latency_ms}")
            print(f"extracted={result.extracted_fields}")
            print(f"score={lead.score} temperature={lead.temperature} status={lead.status}")
            print(f"reply={result.reply[:300]}")

    await engine.dispose()
    print("=" * 60)
    print(f"TOTAL_TOKENS={total_tokens} MODEL={settings.openai_model}")


if __name__ == "__main__":
    asyncio.run(main())
