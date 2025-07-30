from app.core.db import db_handler as db
from app.core.schemas import (
    ConversationCreate,
    MessageCreate,
    MessageOut,
    ConversationMessages
)
from typing import List, Dict, Any


# CONVERSATION CRUD
async def create_conversation(conversation: ConversationCreate) -> int:
    return await db.create_conversation(conversation.title)

async def get_conversations() -> List[Dict[str, Any]]:
    return await db.get_conversations()

async def delete_conversation(conversation_id: int) -> None:
    await db.delete_conversation(conversation_id)

async def get_conversation_context(conversation_id: int) -> str:
    messages = await db.get_conversation_messages(conversation_id)
    return "\n".join([f"{m.sender}: {m.text}" for m in messages])

# MESSAGE CRUD
async def add_message(msg: MessageCreate) -> int:
    return await db.add_message(msg.conversation_id, msg.sender, msg.text, msg.metadata)

async def get_last_message(conversation_id: int, sender: str) -> MessageOut:
    return await db.get_latest_message(conversation_id, sender)

async def get_messages_for_conversation(conversation_id: int) -> ConversationMessages:
    messages = await db.get_conversation_messages(conversation_id)
    return ConversationMessages(
        conversation_id=conversation_id,
        messages=messages
    )