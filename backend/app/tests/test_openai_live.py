"""Live OpenAI smoke tests — disabled by default (costs credits).

Enable with:
  RUN_OPENAI_LIVE_TESTS=true
  AI_MOCK_MODE=false
  OPENAI_API_KEY=<real key>
"""

from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.tests.conftest import requires_db

RUN_LIVE = os.environ.get("RUN_OPENAI_LIVE_TESTS", "").lower() in {"1", "true", "yes"}

pytestmark = [
    pytest.mark.skipif(
        not RUN_LIVE, reason="Set RUN_OPENAI_LIVE_TESTS=true to run live OpenAI tests"
    ),
]


@requires_db
@pytest.mark.asyncio
async def test_live_openai_english_and_french_extraction(db_engine, monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "false")
    from app.core.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    assert not settings.ai_mock_mode
    assert settings.openai_api_key, "OPENAI_API_KEY required for live tests"

    from app.agents.graph import run_agent
    from app.core.enums import ConversationChannel, ConversationStatus, LeadSource, LeadStatus
    from app.models.conversation import Conversation
    from app.models.lead import Lead

    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        cases = [
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
        token_totals: list[int] = []
        used_model = settings.openai_model
        for lang, message in cases:
            lead = Lead(
                first_name="Live",
                last_name=lang.upper(),
                company_name="Live Test Co",
                email=f"live.{lang}.{uuid.uuid4().hex[:8]}@example.com",
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

            assert result.reply
            assert "sk-" not in result.reply.lower()
            assert "api_key" not in result.reply.lower()
            assert result.extracted_fields.get("budget_max") is not None
            assert float(result.extracted_fields["budget_max"]) >= 4000
            assert lead.score and lead.score > 0
            assert lead.temperature in {"COLD", "WARM", "HOT"}

            if not result.fallback_used:
                assert result.model == settings.openai_model
                assert result.language == lang
                if result.total_tokens:
                    token_totals.append(int(result.total_tokens))
            else:
                # Fallback must still work without breaking the conversation
                assert result.model == "deterministic"

        print(
            f"LIVE_OPENAI_MODEL={used_model} LIVE_OPENAI_TOKENS={sum(token_totals)} "
            f"cases={len(cases)}"
        )
