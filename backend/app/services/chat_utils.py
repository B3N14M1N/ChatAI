from __future__ import annotations

from typing import List, Tuple, Optional
from openai import OpenAI

from app.services.file_processor import extract_text_from_file
from app.services.pricing import get_available_models
from app.core.crud import (
    get_cached_conversation_context,
    set_conversation_context,
)


async def generate_conversation_title(client: OpenAI, prompt: str, model: str) -> str:
    title_prompt = (
        f"Generate a very short and concise title for the following conversation topic: {prompt}"
    )
    resp = client.responses.create(model=model, input=title_prompt)
    return resp.output_text.strip()


async def generate_message_summary(client: OpenAI, text: str, model: str = "gpt-4o-mini") -> Optional[str]:
    """
    Generate a concise summary for long messages.
    Returns None if the message is short enough to not need summarization.
    """
    # Only summarize if text is longer than 500 characters
    if len(text) < 500:
        return None
    
    summary_prompt = (
        f"Create a very concise 1-2 sentence summary of the following text. "
        f"Keep it under 100 characters:\n\n{text}"
    )
    
    try:
        resp = client.responses.create(
            model=model, 
            input=summary_prompt,
            max_tokens=50  # Keep summary short
        )
        return resp.output_text.strip()
    except Exception as e:
        print(f"Error generating summary: {e}")
        return None


async def prepare_files_and_prompt(
    base_text: str, files: Optional[List]
) -> Tuple[str, List[Tuple[str, bytes, str]]]:
    """Return (prompt, attachments) building prompt with extracted file content.

    attachments list holds tuples: (filename, raw_bytes, content_type)
    """
    prompt = base_text
    attachments: List[Tuple[str, bytes, str]] = []
    if files:
        for f in files:
            raw = await f.read()
            # Reset file pointer for extraction
            f.file.seek(0)
            content = await extract_text_from_file(f)
            attachments.append((f.filename, raw, f.content_type))
            prompt += f"\nContents of {f.filename}:\n{content}"
    return prompt, attachments


def build_full_prompt(context: Optional[str], prompt: str) -> str:
    if context:
        return f"{context}\nuser prompt: {prompt}"
    return prompt


def determine_tools(model: str):
    pricing_data = get_available_models()
    caps = pricing_data.get(model, {}).get("capabilities", [])
    return [{"type": cap} for cap in caps]


class ModelUsage:
    """Lightweight adapter to expose token usage attributes we rely on."""

    def __init__(self, usage_obj):
        self.input_tokens = usage_obj.input_tokens
        self.output_tokens = usage_obj.output_tokens
        self.total_tokens = usage_obj.total_tokens
        # Some responses may not include detailed caching info; guard access.
        details = getattr(usage_obj, "input_tokens_details", None)
        cached_tokens = 0
        if details and hasattr(details, "cached_tokens"):
            cached_tokens = details.cached_tokens
        self.input_tokens_details = type("_Details", (), {"cached_tokens": cached_tokens})()


def call_model(client: OpenAI, model: str, full_prompt: str, tools):
    call_args = {"model": model, "input": full_prompt}
    if tools:
        call_args["tools"] = tools
    response = client.responses.create(**call_args)
    ai_reply = response.output_text
    usage = ModelUsage(response.usage)
    return ai_reply, usage


async def maybe_summarize_context(
    client: OpenAI,
    conversation_id: int,
    model: str,
    last_user_text: str,
    last_ai_reply: str,
    threshold: int = 2000,
):
    cached = await get_cached_conversation_context(conversation_id)
    if not cached or len(cached) <= threshold:
        return
    summary_prompt = (
        "Summarize the key points of this conversation in a concise bullet list:\n" + cached
    )
    summary_resp = client.responses.create(model=model, input=summary_prompt)
    summary_text = summary_resp.output_text.strip()
    new_context = summary_text + f"\nuser: {last_user_text}\nassistant: {last_ai_reply}"
    await set_conversation_context(conversation_id, new_context)
