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
        'none' => 0 messages
        'last_message' => last request/response pair only 
        'full' => up to 50 messages
        """
        key = f"ctx:{conversation_id}"
        cached = await self.cache.get(key)
        
        if need == "none":
            return []
        elif need == "last_message":
            # Get last 2 messages (user request + assistant response)
            limit = 2
        else:  # need == "full"
            limit = 50
            
        if cached:
            return cached[-limit:] if limit and len(cached) > 0 else []
            
        msgs = await self.context.get_compact_conversation_context(
            conversation_id, 
            max_messages=50, 
            prefer_summaries=True
        )
        await self.cache.set(key, msgs, ttl_seconds=60)
        return msgs[-limit:] if limit and len(msgs) > 0 else []

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
        if conversation_id is None:
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

        # 3) Intent detection (context needs only)
        intent, intent_usage = self.oa.detect_intent(user_text)

        # 4) Decide context scope & fetch compact context
        compact_ctx = await self._get_compact_ctx_cached(conversation_id, intent.context_need)

        # 5) Always try tools-based approach first
        # Let the AI decide whether to use tools or respond directly
        resp, tool_usage = self.oa.generate_with_tools(
            user_message=user_text,
            compact_context=compact_ctx,
        )
        
        # Process any function calls
        input_messages = [{"role": "system", "content": "You are a book recommendation assistant."}]
        input_messages.extend(compact_ctx)
        input_messages.append({"role": "user", "content": user_text})
        input_messages += resp.output
        
        # Execute function calls if any
        has_function_calls = False
        for item in resp.output:
            if item.type == "function_call":
                has_function_calls = True
                result = await self._execute_function_call(item)
                input_messages.append({
                    "type": "function_call_output",
                    "call_id": item.call_id,
                    "output": result
                })
        
        # Generate final response
        if has_function_calls:
            # Final response with tool results
            answer_text, answer_usage = self.oa.generate_final_response(
                input_messages=input_messages
            )
            # Combine usage from tool call and final response
            total_usage = OpenAIUsage(
                input_tokens=tool_usage.input_tokens + answer_usage.input_tokens,
                output_tokens=tool_usage.output_tokens + answer_usage.output_tokens,
                cached_tokens=tool_usage.cached_tokens + answer_usage.cached_tokens,
                model=answer_usage.model
            )
        else:
            # No tools used, use the direct response
            answer_text = resp.output_text.strip()
            total_usage = tool_usage

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
        # Use the total_usage from the tools or direct response
        total_input = total_usage.input_tokens
        total_output = total_usage.output_tokens
        total_cached = total_usage.cached_tokens
        price = self.pricing.price_chat_usage(
            model=total_usage.model,
            input_tokens=total_input,
            output_tokens=total_output,
            cached_tokens=total_cached,
        )
        await self.repo.set_message_usage(
            assistant_msg.id,
            input_tokens=total_input,
            output_tokens=total_output,
            cached_tokens=total_cached,
            model=total_usage.model,
            price=price,
        )

        return {
            "conversation_id": conversation_id,
            "request_message_id": user_msg.id,
            "response_message_id": assistant_msg.id,
            "answer": answer_text,
            "context_need": intent.context_need,
            "usage": {
                "input_tokens": total_input,
                "output_tokens": total_output,
                "cached_tokens": total_cached,
                "model": total_usage.model,
                "price": price,
            }
        }

    async def _execute_function_call(self, function_call) -> str:
        """Execute a function call and return the result as a JSON string."""
        import json
        
        name = function_call.name
        args = json.loads(function_call.arguments)
        
        if name == "get_book_recommendations":
            result = self.rag.recommend(**args)
            return json.dumps({"recommendations": result})
        elif name == "get_book_summaries":
            result = self.rag.get_summaries(**args)
            return json.dumps({"summaries": result})
        else:
            return json.dumps({"error": f"Unknown function: {name}"})
