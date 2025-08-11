from app.core.db import db_handler as db
from app.models.schemas import (
    ConversationCreate,
    MessageCreate,
    MessageOut,
    ConversationMessages,
)
from typing import List, Dict, Any


# CONVERSATION CRUD
async def create_conversation(conversation: ConversationCreate) -> int:
    return await db.create_conversation(conversation.title)


async def rename_conversation(conversation_id: int, new_title: str) -> None:
    await db.rename_conversation(conversation_id, new_title)


async def get_conversations() -> List[Dict[str, Any]]:
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


async def add_message(msg: MessageCreate) -> int:
    # Insert the message and then attachments if provided
    message_id = await db.add_message(
        msg.conversation_id,
        msg.sender,
        msg.text,
        msg.metadata,
        msg.prompt_tokens,
        msg.completion_tokens,
        msg.total_tokens,
        msg.model,
        msg.price,
    )
    return message_id


async def add_attachment(
    message_id: int, filename: str, content: bytes, content_type: str
) -> int:
    """
    Proxy to database handler for adding attachments.
    """
    return await db.add_attachment(message_id, filename, content, content_type)


async def get_last_message(conversation_id: int, sender: str) -> MessageOut:
    msg = await db.get_latest_message(conversation_id, sender)
    if msg:
        # fetch attachments metadata
        attachments = await db.get_attachments_for_message(msg.id)
        msg.attachments = attachments
    return msg


async def get_messages_for_conversation(conversation_id: int) -> ConversationMessages:
    messages = await db.get_conversation_messages(conversation_id)
    # enrich each with attachments
    for m in messages:
        attachments = await db.get_attachments_for_message(m.id)
        m.attachments = attachments
    return ConversationMessages(conversation_id=conversation_id, messages=messages)


async def get_attachment(attachment_id: int) -> Dict[str, Any]:
    """
    Retrieve full attachment record for download.
    """
    attachment = await db.get_attachment(attachment_id)
    if not attachment:
        raise ValueError("Attachment not found")
    return attachment
