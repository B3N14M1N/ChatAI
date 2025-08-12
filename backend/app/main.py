from contextlib import asynccontextmanager

from fastapi import FastAPI, Form, File, UploadFile, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from typing import List, Optional

from app.core.db import db_connector
from app.rag.vector_store import initialize_vector_store
from app.models.schemas import (
    ChatResponse,
    MessageOut,
    ConversationCreate,
    ConversationOut,
    ConversationMessages,
)
from app.core.crud import (
    create_conversation,
    get_conversations,
    delete_conversation,
    get_conversation_context,
    get_messages_for_conversation,
    rename_conversation,
    get_attachment,
)
from app.services.chat import chat_call
from app.services.pricing import get_available_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database connection and tables on startup
    await db_connector.init_db()
    initialize_vector_store()
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
    conversation_id: Optional[int] = Form(None),
    text: str = Form(...),
    model: str = Form(...),
    summary: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
):
    # Delegate full conversation handling (message persistence, attachments, AI call) to service
    ai_reply: MessageOut = await chat_call(
        text=text,
        files=files,
        conversation_id=conversation_id,
        model=model,
        summary=summary,
    )
    return ChatResponse(**ai_reply.model_dump())


@app.post("/conversations/", response_model=int)
async def create_conversation_endpoint(conversation: ConversationCreate):
    return await create_conversation(conversation)


@app.put("/conversations/{conversation_id}/rename")
async def rename_conversation_endpoint(conversation_id: int, new_title: str):
    await rename_conversation(conversation_id, new_title)
    return {"detail": "Conversation renamed successfully"}


@app.get("/conversations/", response_model=List[ConversationOut])
async def get_conversations_endpoint():
    return await get_conversations()


@app.delete("/conversations/{conversation_id}")
async def delete_conversation_endpoint(conversation_id: int):
    await delete_conversation(conversation_id)
    return {"detail": "Conversation deleted"}


@app.get(
    "/conversations/{conversation_id}/messages", response_model=ConversationMessages
)
async def get_conversation_messages_endpoint(conversation_id: int):
    return await get_messages_for_conversation(conversation_id)


@app.get("/conversations/{conversation_id}/context", response_model=str)
async def get_conversation_context_endpoint(conversation_id: int):
    return await get_conversation_context(conversation_id)


@app.get("/models", response_model=dict)
async def get_models_endpoint():
    """
    Retrieve available models along with their version, pricing, and capabilities metadata.
    """
    return get_available_models()


@app.get("/attachments/{attachment_id}")
async def download_attachment(attachment_id: int):
    """
    Download raw attachment content by ID.
    """
    try:
        attachment = await get_attachment(attachment_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    headers = {"Content-Disposition": f'attachment; filename="{attachment.filename}"'}
    return Response(attachment.content, media_type=attachment.content_type, headers=headers)
