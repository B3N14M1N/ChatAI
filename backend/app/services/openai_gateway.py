from __future__ import annotations
import os
from typing import List, Optional, Dict, Any
from openai import OpenAI
from pydantic import BaseModel
from ..models.intents import IntentEnvelope

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-nano")
TITLE_MODEL = os.getenv("OPENAI_TITLE_MODEL", "gpt-4.1-nano")
INTENT_MODEL = os.getenv("OPENAI_INTENT_MODEL", "gpt-4.1-nano")
SUMMARY_MODEL = os.getenv("OPENAI_SUMMARY_MODEL", "gpt-4.1-nano")


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
                {
                    "role": "system",
                    "content": "Create a 3-8 word concise title based on the user's message.",
                },
                {"role": "user", "content": user_message},
            ],
            max_output_tokens=32,
        )
        title = (resp.output_text or "").strip().strip('"')
        usage = OpenAIUsage(
            input_tokens=resp.usage.input_tokens if resp.usage else 0,
            output_tokens=resp.usage.output_tokens if resp.usage else 0,
            cached_tokens=(
                resp.usage.input_tokens_details.cached_tokens if resp.usage else 0
            ),
            model=TITLE_MODEL,
        )
        return title, usage

    # 2) Intent detection with structured output
    def detect_intent(self, user_message: str) -> tuple[IntentEnvelope, OpenAIUsage]:
        # responses API structured outputs via parse
        resp = self.client.responses.parse(
            model=INTENT_MODEL,
            input=[
                {
                    "role": "system",
                    "content": (
                        "Analyze the user's message and determine how much conversation context is needed to respond appropriately. "
                        "Return JSON with field: context_need. "
                        "Use 'none' if the message is standalone (greetings, general questions, clear requests). "
                        "Use 'last_message' if the message refers to something from the immediate previous exchange "
                        "(like 'yes', 'tell me more', 'what about X', follow-up questions). "
                        "Use 'full' if the message requires understanding the entire conversation history."
                    ),
                },
                {"role": "user", "content": user_message},
            ],
            text_format=IntentEnvelope,
        )
        intent = resp.output_parsed
        usage = OpenAIUsage(
            input_tokens=resp.usage.input_tokens if resp.usage else 0,
            output_tokens=resp.usage.output_tokens if resp.usage else 0,
            cached_tokens=(
                resp.usage.input_tokens_details.cached_tokens if resp.usage else 0
            ),
            model=INTENT_MODEL,
        )
        return intent, usage

    # 3) Summarize a long message (for compact context)
    def summarize(self, text: str, max_words: int = 80) -> tuple[str, OpenAIUsage]:
        resp = self.client.responses.create(
            model=SUMMARY_MODEL,
            input=[
                {
                    "role": "system",
                    "content": f"Summarize in <= {max_words} words. KEEP concrete details: book titles, author names, specific requests, numbers, and factual information. Preserve the essence and specific content, not just abstract themes.",
                },
                {"role": "user", "content": text},
            ],
            max_output_tokens=200,
        )
        summary = resp.output_text.strip()
        usage = OpenAIUsage(
            input_tokens=resp.usage.input_tokens if resp.usage else 0,
            output_tokens=resp.usage.output_tokens if resp.usage else 0,
            cached_tokens=(
                resp.usage.input_tokens_details.cached_tokens if resp.usage else 0
            ),
            model=SUMMARY_MODEL,
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
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(compact_context)
        # Add the tool output as a hidden/system-like context block
        if tool_data is not None:
            messages.append(
                {"role": "system", "content": f"tool_data(json): {tool_data}"}
            )
        messages.append({"role": "user", "content": user_message})

        resp = self.client.responses.create(
            model=model,
            input=messages,
            max_output_tokens=max_output_tokens,
        )
        text = resp.output_text.strip()
        usage = OpenAIUsage(
            input_tokens=resp.usage.input_tokens if resp.usage else 0,
            output_tokens=resp.usage.output_tokens if resp.usage else 0,
            cached_tokens=(
                resp.usage.input_tokens_details.cached_tokens if resp.usage else 0
            ),
            model=model,
        )
        return text, usage

    # 5) Tools definitions for function calling
    def get_tools_definition(self) -> List[Dict[str, Any]]:
        return [
            {
                "type": "function",
                "name": "get_book_recommendations",
                "description": "Get book recommendations. Only include genres/themes/authors that the user explicitly mentions. Do not infer or add additional genres/themes/authors.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "genres": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of book genres ONLY if explicitly mentioned by user (e.g., ['fantasy', 'sci-fi'])",
                        },
                        "themes": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of themes ONLY if explicitly mentioned by user (e.g., ['friendship', 'adventure'])",
                        },
                        "authors": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of author names ONLY if explicitly mentioned by user (e.g., ['George Orwell', 'Jane Austen'])",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of recommendations to return",
                            "default": 5,
                        },
                        "random": {
                            "type": "boolean",
                            "description": "Whether to return random recommendations",
                            "default": False,
                        },
                    },
                    "additionalProperties": False,
                },
            },
            {
                "type": "function",
                "name": "get_book_summaries",
                "description": "Get detailed summaries for specific book titles.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titles": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of book titles to get summaries for",
                        }
                    },
                    "required": ["titles"],
                    "additionalProperties": False,
                },
            },
        ]

    # 6) Generate response with tools
    def generate_with_tools(
        self,
        *,
        user_message: str,
        compact_context: List[dict],
        model: str = DEFAULT_MODEL,
        max_output_tokens: int = 600,
    ) -> tuple[dict, OpenAIUsage]:
        """
        Generate a response that may include function calls.
        Returns the full response object and usage info.
        """
        system_prompt = (
            "You are a book recommendation assistant. "
            "Use the get_book_recommendations tool when users ask for book suggestions, recommendations, or want to find books. "
            "ONLY include genres/themes/authors that the user explicitly mentions - do not infer or add additional categories. "
            "Use the get_book_summaries tool when users ask about specific book titles or want summaries."
        )

        input_messages = [{"role": "system", "content": system_prompt}]
        input_messages.extend(compact_context)
        input_messages.append({"role": "user", "content": user_message})

        tools = self.get_tools_definition()

        resp = self.client.responses.create(
            model=model,
            tools=tools,
            input=input_messages,
            max_output_tokens=max_output_tokens,
        )

        usage = OpenAIUsage(
            input_tokens=resp.usage.input_tokens if resp.usage else 0,
            output_tokens=resp.usage.output_tokens if resp.usage else 0,
            cached_tokens=(
                resp.usage.input_tokens_details.cached_tokens if resp.usage else 0
            ),
            model=model,
        )

        return resp, usage

    # 7) Generate final response after tool calls
    def generate_final_response(
        self,
        *,
        input_messages: List[dict],
        model: str = DEFAULT_MODEL,
        max_output_tokens: int = 600,
    ) -> tuple[str, OpenAIUsage]:
        """
        Generate the final response after tool calls have been processed.
        """
        # Add system instruction for natural responses
        final_messages = [
            {
                "role": "system",
                "content": (
                    "You are a book recommendation assistant with access to a specific book database. "
                    "ONLY recommend books from the tool results provided - NEVER suggest books not in the results. "
                    "NEVER mention internal processes like 'I retrieved', 'I searched', 'I pulled up', 'the tool returned', etc. "
                    "If the tool results don't contain suitable books for the user's request, simply say 'I don't have any books in my collection that match your criteria.' "
                    "If the results contain books that don't match the request, treat it as if no suitable books were found. "
                    "Present any valid recommendations naturally as if you know them from your collection. Be conversational and helpful, but stay strictly within the provided data."
                ),
            }
        ] + input_messages[
            1:
        ]  # Skip the original system message, use our new one

        tools = self.get_tools_definition()

        resp = self.client.responses.create(
            model=model,
            tools=tools,
            input=final_messages,
            max_output_tokens=max_output_tokens,
        )

        text = resp.output_text.strip()
        usage = OpenAIUsage(
            input_tokens=resp.usage.input_tokens if resp.usage else 0,
            output_tokens=resp.usage.output_tokens if resp.usage else 0,
            cached_tokens=(
                resp.usage.input_tokens_details.cached_tokens if resp.usage else 0
            ),
            model=model,
        )

        return text, usage
