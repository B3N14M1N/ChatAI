from typing import List, Optional, Tuple
from openai import OpenAI

from app.services.pricing import calculate_price
from app.models.schemas import (
    MessageCreate, 
    MessageOut, 
    ConversationCreate,
    UserMessageCreate,
    AssistantResponseCreate,
    UsageMetrics,
)
from app.rag.dispatch import dispatch_tool_call
from app.core.crud import (
    append_to_conversation_context,
    get_last_assistant_message,
    add_user_message,
    add_assistant_response,
    create_conversation,
    add_attachment,
)

from .chat_utils import (
    ModelUsage,
    generate_conversation_title,
    generate_message_summary,
    prepare_files_and_prompt,
    build_full_prompt,
    maybe_summarize_context,
)
from .context_manager import smart_context_handler
from app.models.schemas import MessageIntent

client = OpenAI()


async def _get_regular_chat_response(model: str, prompt: str) -> tuple[str, ModelUsage]:
    """Handle regular chat completions for non-tool messages"""
    try:
        response = client.responses.create(
            model=model,
            input=prompt,
            max_output_tokens=4000
        )
        reply = response.output_text
        usage = ModelUsage(response.usage)
        return reply, usage
    except Exception as e:
        print(f"Error in regular chat completion: {e}")
        # Fallback to dispatch if regular chat fails
        return dispatch_tool_call(model, prompt, "")


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
    summary: Optional[str],
    attachments: List[Tuple[str, bytes, str]],
) -> int:
    """Store the user's message & related attachments, update cached context."""
    user_msg_id = await add_user_message(
        UserMessageCreate(
            conversation_id=conversation_id,
            text=text,
            summary=summary,
        )
    )
    await append_to_conversation_context(conversation_id, "user", text)
    for filename, raw, ctype in attachments:
        await add_attachment(user_msg_id, filename, raw, ctype)
    return user_msg_id


async def _persist_assistant_message(
    conversation_id: int,
    request_id: int,
    reply_text: str,
    model: str,
    usage,
    price: float,
    summary: Optional[str],
) -> int:
    """Store assistant reply & update context."""
    assistant_msg_id = await add_assistant_response(
        AssistantResponseCreate(
            conversation_id=conversation_id,
            request_id=request_id,
            text=reply_text,
            summary=summary,
            usage_metrics=UsageMetrics(
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                cached_tokens=getattr(usage, 'cached_tokens', None),
                model=model,
                price=price,
            )
        )
    )
    await append_to_conversation_context(conversation_id, "assistant", reply_text)
    return assistant_msg_id


async def chat_call(
    text: str,
    files: List = None,
    conversation_id: Optional[int] = None,
    model: str = "gpt-4.1",
    summary: Optional[str] = None,
) -> MessageOut:
    """Primary chat entrypoint orchestrating the flow of a single exchange with smart context."""
    conversation_id = await _ensure_conversation(conversation_id, text, model)

    # Use smart context management instead of always including full context
    smart_context, intent, strategy = await smart_context_handler(text, conversation_id)
    
    # Optional: Log context decisions for debugging
    print(f"Intent: {intent.value}, Strategy: {strategy.value}, Context length: {len(smart_context)}")
    
    prompt, file_attachments = await prepare_files_and_prompt(text, files)
    
    # Build prompt with smart context instead of cached context
    full_prompt = build_full_prompt(smart_context, prompt)

    # Generate summary for user message if needed and not provided
    if summary is None:
        summary = await generate_message_summary(client, text, model)

    user_msg_id = await _persist_user_message(
        conversation_id,
        text,
        summary,
        file_attachments
    )
    
    # Choose response method based on intent
    if intent in [MessageIntent.BOOK_RECOMMENDATION, MessageIntent.BOOK_SUMMARY]:
        # Use tool dispatch for book-related queries
        tool_response, usage = dispatch_tool_call(model, full_prompt, smart_context)
        ai_reply = str(tool_response)
    else:
        # Use regular chat completion for general conversation
        ai_reply, usage = await _get_regular_chat_response(model, full_prompt)
    
    # Generate summary for AI response if needed
    ai_summary = await generate_message_summary(client, ai_reply, model)
    
    price = calculate_price(
        model,
        usage.input_tokens,
        usage.output_tokens,
        usage.input_tokens_details.cached_tokens,
    )

    await _persist_assistant_message(
        conversation_id,
        user_msg_id,  # Pass the user message ID as request_id
        ai_reply,
        model,
        usage,
        price,
        ai_summary  # Pass AI response summary
    )

    await maybe_summarize_context(client, conversation_id, model, text, ai_reply)

    return await get_last_assistant_message(conversation_id)
