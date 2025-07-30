from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from typing import List

from app.core.db import db_connector
from app.core.schemas import (
    ChatRequest,
    ChatResponse,
    MessageOut,
    ConversationCreate,
    ConversationMessages,
)
from app.core.crud import (
    create_conversation,
    get_conversations,
    delete_conversation,
    get_conversation_context,
    get_messages_for_conversation
)
from app.services.chat import chat_call



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database connection and tables on startup
    await db_connector.init_db()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Hello, FastAPI!"}


@app.post("/chat/", response_model=ChatResponse)
async def chat_endpoint(
    req: ChatRequest
):
    ai_reply: MessageOut = await chat_call(
        prompt=req.text,
        conversation_id=req.conversation_id,
        model=req.model,
        metadata=req.metadata
    )
    return ChatResponse(**ai_reply.dict(), model=req.model)


@app.post("/conversations/", response_model=int)
async def create_conversation_endpoint(conversation: ConversationCreate):
    return await create_conversation(conversation)


@app.get("/conversations/", response_model=List[dict])
async def get_conversations_endpoint():
    return await get_conversations()


@app.delete("/conversations/{conversation_id}")
async def delete_conversation_endpoint(conversation_id: int):
    await delete_conversation(conversation_id)
    return {"detail": "Conversation deleted"}


@app.get("/conversations/{conversation_id}/messages", response_model=ConversationMessages)
async def get_conversation_messages_endpoint(conversation_id: int):
    return await get_messages_for_conversation(conversation_id)


@app.get("/conversations/{conversation_id}/context", response_model=str)
async def get_conversation_context_endpoint(conversation_id: int):
    return await get_conversation_context(conversation_id)