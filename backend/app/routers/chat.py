from fastapi import APIRouter, Depends, HTTPException
from backend.app.core.schemas import MessageCreate, MessageOut
from backend.app.core.db import DatabaseConnector, DatabaseHandler
from app.services.chat import chat_call
from backend.app.services.crud import get_messages_for_conversation
from typing import List

router = APIRouter(prefix="/chat", tags=["chat"])

async def get_db_handler():
    connector = DatabaseConnector()
    await connector.connect()
    await connector.init_db()
    handler = DatabaseHandler(connector)
    try:
        yield handler
    finally:
        await connector.close()

class ChatRequest(MessageCreate):
    model: str = "gpt-4.1"

class ChatResponse(MessageOut):
    model: str

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(
    req: ChatRequest,
    db: DatabaseHandler = Depends(get_db_handler)
):
    ai_reply = await chat_call(
        db=db,
        prompt=req.text,
        conversation_id=req.conversation_id,
        sender=req.sender,
        model=req.model,
        metadata=req.metadata
    )
    # Get the last AI message
    messages = await get_messages_for_conversation(db, req.conversation_id)
    ai_message = next((m for m in reversed(messages) if m["sender"] == "assistant"), None)
    if not ai_message:
        raise HTTPException(status_code=500, detail="AI reply not saved")
    return ChatResponse(**ai_message, model=req.model)

@router.get("/messages/{conversation_id}", response_model=List[MessageOut])
async def get_messages(conversation_id: int, db: DatabaseHandler = Depends(get_db_handler)):
    messages = await get_messages_for_conversation(db, conversation_id)
    return [MessageOut(**m) for m in messages]
