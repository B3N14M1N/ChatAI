"""Chat service orchestration logic.

This module coordinates a chat exchange while delegating most sub-steps
to helper functions in chat_utils for readability & easier extension.
"""

from typing import List, Optional, Tuple
from openai import OpenAI

from app.services.pricing import calculate_price
from app.models.schemas import MessageCreate, MessageOut, ConversationCreate
from app.rag.dispatch import dispatch_tool_call
from app.core.crud import (
    get_cached_conversation_context,
    append_to_conversation_context,
    get_last_message,
    add_message,
    create_conversation,
    add_attachment,
)

from .chat_utils import (
    ModelUsage,
    generate_conversation_title,
    prepare_files_and_prompt,
    build_full_prompt,
    determine_tools,
    call_model,
    maybe_summarize_context,
)

client = OpenAI()


async def _ensure_conversation(
    conversation_id: Optional[int],
    first_user_text: str,
    model: str
) -> int:
    """Create a conversation (with generated title) if needed and return its id."""
    if conversation_id is not None:
        return conversation_id
    title = await generate_conversation_title(client, first_user_text, model)
    return await create_conversation(ConversationCreate(title=title))


async def _persist_user_message(
    conversation_id: int,
    text: str,
    metadata: Optional[str],
    attachments: List[Tuple[str, bytes, str]],
) -> int:
    """Store the user's message & related attachments, update cached context."""
    user_msg_id = await add_message(
        MessageCreate(
            conversation_id=conversation_id,
            sender="user",
            text=text,
            metadata=metadata,
        )
    )
    await append_to_conversation_context(conversation_id, "user", text)
    for filename, raw, ctype in attachments:
        await add_attachment(user_msg_id, filename, raw, ctype)
    return user_msg_id


async def _persist_assistant_message(
    conversation_id: int,
    reply_text: str,
    model: str,
    usage,
    price: float,
    metadata: Optional[str],
) -> int:
    """Store assistant reply & update context."""
    assistant_msg_id = await add_message(
        MessageCreate(
            conversation_id=conversation_id,
            sender="assistant",
            text=reply_text,
            metadata=metadata,
            prompt_tokens=usage.input_tokens,
            completion_tokens=usage.output_tokens,
            total_tokens=usage.total_tokens,
            model=model,
            price=price,
        )
    )
    await append_to_conversation_context(conversation_id, "assistant", reply_text)
    return assistant_msg_id


async def chat_call(
    text: str,
    files: List = None,
    conversation_id: Optional[int] = None,
    model: str = "gpt-4.1",
    metadata: Optional[str] = None,
) -> MessageOut:
    """Primary chat entrypoint orchestrating the flow of a single exchange."""
    conversation_id = await _ensure_conversation(conversation_id, text, model)

    prompt, file_attachments = await prepare_files_and_prompt(text, files)

    context = await get_cached_conversation_context(conversation_id)
    full_prompt = build_full_prompt(context, prompt)

    await _persist_user_message(
        conversation_id,
        text,
        metadata,
        file_attachments
    )
    
    tool_response, usage = dispatch_tool_call(model, text)
    #tool_response, usage = dispatch_tool_call(model, full_prompt)
    
    ai_reply = str(tool_response)
    
    price = calculate_price(
        model,
        usage.input_tokens,
        usage.output_tokens,
        usage.input_tokens_details.cached_tokens,
    )

    await _persist_assistant_message(
        conversation_id,
        ai_reply,
        model,
        usage,
        price,
        metadata
    )

    await maybe_summarize_context(client, conversation_id, model, text, ai_reply)

    return await get_last_message(conversation_id, "assistant")
