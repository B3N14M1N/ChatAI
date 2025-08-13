from __future__ import annotations
import os
from typing import List, Optional
from openai import OpenAI
from pydantic import BaseModel
from ..models.intents import IntentEnvelope

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-nano")
TITLE_MODEL = os.getenv("OPENAI_TITLE_MODEL", "gpt-4o-nano")
INTENT_MODEL = os.getenv("OPENAI_INTENT_MODEL", "gpt-4o-nano")
SUMMARY_MODEL = os.getenv("OPENAI_SUMMARY_MODEL", "gpt-4o-nano")

class OpenAIUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cached_tokens: int = 0
    model: str = DEFAULT_MODEL

class OpenAIGateway:
    def __init__(self):
        self.client = OpenAI()

    # 1) Title generation (short & concise)
    def generate_title(self, user_message: str) -> tuple[str, OpenAIUsage]:
        resp = self.client.responses.create(
            model=TITLE_MODEL,
            input=[
                {"role":"system","content":"Create a 3-8 word concise title for a book-recommendation chat."},
                {"role":"user","content": user_message}
            ],
            max_output_tokens=32,
        )
        title = (resp.output_text or "").strip().strip('"')
        usage = OpenAIUsage(
            input_tokens=resp.usage.input_tokens if resp.usage else 0,
            output_tokens=resp.usage.output_tokens if resp.usage else 0,
            cached_tokens=resp.usage.cached_tokens if resp.usage else 0,
            model=TITLE_MODEL
        )
        return title, usage

    # 2) Intent detection with structured output
    def detect_intent(self, user_message: str) -> tuple[IntentEnvelope, OpenAIUsage]:
        # responses API structured outputs via json_schema
        resp = self.client.responses.create(
            model=INTENT_MODEL,
            input=[
                {"role":"system","content":(
                    "You label the user's request. "
                    "Return JSON with fields: intent, context_need, titles, filter{genres,themes,random,limit}. "
                    "Use 'book_recommendations' when asking for recs; 'book_summary' when asking a summary for specific titles; "
                    "'smalltalk' for greetings; otherwise 'other'. "
                    "Prefer context_need: 'none'|'light'|'full' based on how much chat history is useful."
                )},
                {"role":"user","content": user_message}
            ],
            response_format={"type":"json_schema","json_schema":{
                "name":"intent_schema",
                "schema": IntentEnvelope.model_json_schema()
            }},
            max_output_tokens=256,
        )
        j = resp.output[0].content[0].text  # responses API returns JSON string chunk
        intent = IntentEnvelope.model_validate_json(j)
        usage = OpenAIUsage(
            input_tokens=resp.usage.input_tokens if resp.usage else 0,
            output_tokens=resp.usage.output_tokens if resp.usage else 0,
            cached_tokens=resp.usage.cached_tokens if resp.usage else 0,
            model=INTENT_MODEL
        )
        return intent, usage

    # 3) Summarize a long message (for compact context)
    def summarize(self, text: str, max_words: int = 80) -> tuple[str, OpenAIUsage]:
        resp = self.client.responses.create(
            model=SUMMARY_MODEL,
            input=[
                {"role":"system","content":f"Summarize in <= {max_words} words, keep salient user goals and constraints."},
                {"role":"user","content": text}
            ],
            max_output_tokens=200,
        )
        summary = resp.output_text.strip()
        usage = OpenAIUsage(
            input_tokens=resp.usage.input_tokens if resp.usage else 0,
            output_tokens=resp.usage.output_tokens if resp.usage else 0,
            cached_tokens=resp.usage.cached_tokens if resp.usage else 0,
            model=SUMMARY_MODEL
        )
        return summary, usage

    # 4) Final answer generation given already-computed tool results
    def generate_final_answer(
        self,
        *,
        user_message: str,
        compact_context: List[dict],
        tool_data: Optional[dict] = None,
        model: str = DEFAULT_MODEL,
        max_output_tokens: int = 600,
    ) -> tuple[str, OpenAIUsage]:
        system_prompt = (
            "You are a book recommendation assistant. "
            "Only rely on tool_data for catalog facts. "
            "If tool_data shows no matches, say 'No matches found' and offer alternatives."
        )
        messages = [{"role":"system","content":system_prompt}]
        messages.extend(compact_context)
        # Add the tool output as a hidden/system-like context block
        if tool_data is not None:
            messages.append({"role":"system","content":f"tool_data(json): {tool_data}"})
        messages.append({"role":"user","content":user_message})

        resp = self.client.responses.create(
            model=model,
            input=messages,
            max_output_tokens=max_output_tokens,
        )
        text = resp.output_text.strip()
        usage = OpenAIUsage(
            input_tokens=resp.usage.input_tokens if resp.usage else 0,
            output_tokens=resp.usage.output_tokens if resp.usage else 0,
            cached_tokens=resp.usage.cached_tokens if resp.usage else 0,
            model=model
        )
        return text, usage
