from __future__ import annotations
from typing import Optional, List, Dict, Any
from pathlib import Path

from ..db.repository import Repository
from ..models.schemas import MessageCreate, MessageUpdate
from ..models.intents import IntentEnvelope
from .cache import TTLCache
from .pricing import PricingService
from .openai_gateway import OpenAIGateway, OpenAIUsage
from .rag import BookRAG
from ..services.context import ContextService

class ChatPipeline:
    def __init__(
        self,
        repo: Repository,
        pricing: PricingService,
        rag: BookRAG,
        oa: OpenAIGateway,
        cache: TTLCache,
        context: ContextService,
    ):
        self.repo = repo
        self.pricing = pricing
        self.rag = rag
        self.oa = oa
        self.cache = cache
        self.context = context

    async def _invalidate_context_cache(self, conversation_id: int):
        await self.cache.delete(f"ctx:{conversation_id}")

    async def _get_compact_ctx_cached(self, conversation_id: int, need: str) -> List[dict]:
        """
        'none' => 0 messages, 'light' => last ~10, 'full' => up to 50
        """
        key = f"ctx:{conversation_id}"
        cached = await self.cache.get(key)
        limit = 0 if need == "none" else (10 if need == "light" else 50)
        if cached:
            return cached[-limit:] if limit else []
        msgs = await self.context.get_compact_conversation_context(conversation_id, max_messages=50, prefer_summaries=True)
        await self.cache.set(key, msgs, ttl_seconds=60)
        return msgs[-limit:] if limit else []

    async def handle_user_message(
        self,
        *,
        conversation_id: Optional[int],
        user_text: str,
    ) -> Dict[str, Any]:
        """
        1) Create conversation (with title) if needed
        2) Persist user message (with summary if long)
        3) Intent detection -> decide context scope
        4) Tool calls (RAG) if needed
        5) Final answer, then summarize if long
        6) Persist assistant message with usage+price
        """
        # 1) Conversation bootstrap
        new_conversation = False
        if conversation_id is None:
            new_conversation = True
            title, title_usage = self.oa.generate_title(user_text)
            # build ConversationCreate inline
            from ..models.schemas import ConversationCreate
            c = ConversationCreate(title=title.strip() or "New chat")
            conv = await self.repo.create_conversation(c)
            conversation_id = conv.id
        else:
            conv = await self.repo.get_conversation(conversation_id)
        # 2) Persist user message (with optional summary)
        # Heuristic: summarize if > 400 chars
        summary_text = None
        title_usage = None  # silence type checker reuse
        if len(user_text) > 400:
            summary_text, sum_usage = self.oa.summarize(user_text)
        # user message create
        user_msg = await self.repo.create_message(MessageCreate(
            conversation_id=conversation_id,
            request_id=None,
            text=user_text,
            summary=summary_text
        ))
        await self._invalidate_context_cache(conversation_id)

        # 3) Intent detection
        intent, intent_usage = self.oa.detect_intent(user_text)

        # 4) Decide context scope & fetch compact context
        compact_ctx = await self._get_compact_ctx_cached(conversation_id, intent.context_need)

        # 5) Tooling
        tool_payload: Optional[dict] = None
        if intent.intent == "book_recommendations":
            f = intent.filter or {}
            recs = self.rag.recommend(
                genres=f.genres if getattr(f, "genres", None) else None,
                themes=f.themes if getattr(f, "themes", None) else None,
                limit=f.limit if getattr(f, "limit", None) else 5,
                random=bool(getattr(f, "random", False))
            )
            tool_payload = {"type":"recommendations","items":recs}
        elif intent.intent == "book_summary":
            titles = intent.titles or []
            sums = self.rag.get_summaries(titles)
            tool_payload = {"type":"summaries","items":sums}
        else:
            tool_payload = None

        # 6) Final answer
        answer_text, answer_usage = self.oa.generate_final_answer(
            user_message=user_text,
            compact_context=compact_ctx,
            tool_data=tool_payload,
        )

        # 7) Summarize long assistant answer for compact context
        ans_summary = None
        if len(answer_text) > 600:
            ans_summary, _ = self.oa.summarize(answer_text, max_words=80)

        # 8) Persist assistant response (link via request_id=user_msg.id)
        assistant_msg = await self.repo.create_message(MessageCreate(
            conversation_id=conversation_id,
            request_id=user_msg.id,
            text=answer_text,
            summary=ans_summary
        ))

        # 9) Usage & pricing aggregation and persistence
        # For simplicity we attach only the final answer usage to the assistant message.
        # You can also record title/intent/summarization usage on their own rows if preferred.
        total_input = answer_usage.input_tokens
        total_output = answer_usage.output_tokens
        total_cached = answer_usage.cached_tokens
        price = self.pricing.price_chat_usage(
            model=answer_usage.model,
            input_tokens=total_input,
            output_tokens=total_output,
            cached_tokens=total_cached,
        )
        await self.repo.set_message_usage(
            assistant_msg.id,
            input_tokens=total_input,
            output_tokens=total_output,
            cached_tokens=total_cached,
            model=answer_usage.model,
            price=price,
        )

        return {
            "conversation_id": conversation_id,
            "request_message_id": user_msg.id,
            "response_message_id": assistant_msg.id,
            "answer": answer_text,
            "intent": intent.model_dump(),
            "tool_payload": tool_payload,
            "usage": {
                "input_tokens": total_input,
                "output_tokens": total_output,
                "cached_tokens": total_cached,
                "model": answer_usage.model,
                "price": price,
            }
        }
