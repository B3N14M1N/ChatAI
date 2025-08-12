from app.core.db import db_handler as db
from app.models.schemas import (
    ConversationCreate,
    ConversationOut,
    MessageCreate,
    MessageOut,
    ConversationMessages,
    AttachmentOut,
    AttachmentDownload,
    UserMessageCreate,
    AssistantResponseCreate,
    UsageMetrics,
)
from typing import List, Dict, Any, Optional


# CONVERSATION CRUD
async def create_conversation(conversation: ConversationCreate) -> int:
    return await db.create_conversation(conversation.title)


async def rename_conversation(conversation_id: int, new_title: str) -> None:
    await db.rename_conversation(conversation_id, new_title)


async def get_conversations() -> List[ConversationOut]:
    return await db.get_conversations()


async def delete_conversation(conversation_id: int) -> None:
    await db.delete_conversation(conversation_id)


async def get_conversation_context(conversation_id: int) -> str:
    messages = await db.get_conversation_messages(conversation_id)
    return "\n".join([f"{m.sender}: {m.text}" for m in messages])
    # Note: this function fetches fresh context from DB


# In-memory cache for conversation contexts
_context_cache: Dict[int, str] = {}


async def get_cached_conversation_context(conversation_id: int) -> str:
    """
    Retrieve conversation context from cache or DB.
    """
    if conversation_id not in _context_cache:
        _context_cache[conversation_id] = await get_conversation_context(
            conversation_id
        )
    return _context_cache[conversation_id]


async def set_conversation_context(conversation_id: int, context: str) -> None:
    """
    Set or replace the cached conversation context.
    """
    _context_cache[conversation_id] = context


async def append_to_conversation_context(
    conversation_id: int, sender: str, text: str
) -> None:
    """
    Append a new message to the cached conversation context.
    """
    entry = f"{sender}: {text}"
    if conversation_id in _context_cache:
        _context_cache[conversation_id] += "\n" + entry
    else:
        _context_cache[conversation_id] = entry


"""
MESSAGE CRUD
Store and return messages with usage metrics.
"""


async def add_user_message(msg: UserMessageCreate) -> int:
    """Add a user message to the conversation."""
    return await db.add_user_message(
        conversation_id=msg.conversation_id,
        text=msg.text,
        summary=msg.summary,
    )


async def add_assistant_response(msg: AssistantResponseCreate) -> int:
    """Add an assistant response to the conversation."""
    usage = msg.usage_metrics or UsageMetrics()
    return await db.add_assistant_response(
        conversation_id=msg.conversation_id,
        text=msg.text,
        request_id=msg.request_id,
        summary=msg.summary,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        cached_tokens=usage.cached_tokens,
        model=usage.model,
        price=usage.price,
    )


# Deprecated: Use add_user_message or add_assistant_response instead
async def add_message(msg: MessageCreate) -> int:
    """
    Legacy message creation - prefer add_user_message or add_assistant_response.
    """
    return await db.add_message(
        conversation_id=msg.conversation_id,
        text=msg.text,
        summary=msg.summary,
        request_id=msg.request_id,
        input_tokens=msg.input_tokens,
        output_tokens=msg.output_tokens,
        cached_tokens=msg.cached_tokens,
        model=msg.model,
        price=msg.price,
    )


async def add_attachment(
    message_id: int, filename: str, content: bytes, content_type: str
) -> int:
    """
    Proxy to database handler for adding attachments.
    """
    return await db.add_attachment(message_id, filename, content, content_type)


async def get_last_user_message(conversation_id: int) -> Optional[MessageOut]:
    """Get the latest user message in a conversation."""
    msg = await db.get_latest_message(conversation_id, is_user=True)
    if msg:
        # fetch attachments metadata
        attachments = await db.get_attachments_for_message(msg.id)
        msg.attachments = attachments
    return msg


async def get_last_assistant_message(conversation_id: int) -> Optional[MessageOut]:
    """Get the latest assistant message in a conversation."""
    msg = await db.get_latest_message(conversation_id, is_user=False)
    if msg:
        # fetch attachments metadata
        attachments = await db.get_attachments_for_message(msg.id)
        msg.attachments = attachments
    return msg


# Deprecated: Use get_last_user_message or get_last_assistant_message
async def get_last_message(conversation_id: int, sender: str) -> MessageOut:
    """Legacy function - use get_last_user_message or get_last_assistant_message instead."""
    is_user = sender == "user"
    return await db.get_latest_message(conversation_id, is_user=is_user)


async def get_messages_for_conversation(conversation_id: int) -> ConversationMessages:
    messages = await db.get_conversation_messages(conversation_id)
    # enrich each with attachments
    for m in messages:
        attachments = await db.get_attachments_for_message(m.id)
        m.attachments = attachments
    return ConversationMessages(conversation_id=conversation_id, messages=messages)


async def get_attachment(attachment_id: int) -> AttachmentDownload:
    """
    Retrieve full attachment record for download.
    """
    attachment_data = await db.get_attachment(attachment_id)
    if not attachment_data:
        raise ValueError("Attachment not found")
    
    return AttachmentDownload(
        id=attachment_data["id"],
        message_id=attachment_data["message_id"],
        filename=attachment_data["filename"],
        content_type=attachment_data["content_type"],
        content=attachment_data["content"]
    )
