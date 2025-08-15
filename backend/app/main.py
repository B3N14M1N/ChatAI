from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Response, Form, File, UploadFile

from app.db.connector import DatabaseConnector
from app.db.initializer import DatabaseInitializer
from app.db.crud import Crud
from app.db.repository import Repository
from app.models.schemas import ConversationCreate
from app.services.context import ContextService
from app.services.cache import TTLCache
from app.services.pricing import PricingService
from app.services.openai_gateway import OpenAIGateway
from app.services.rag import BookRAG
from app.services.pipelines import ChatPipeline
from app.services.models_catalog import get_available_models_from_pricing
from app.models.api_schemas import (
    ConversationOut,
    ConversationMessages,
    SendMessageResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Paths for local assets
    project_root = Path(__file__).resolve().parents[0]
    data_dir = project_root / "data"
    books_path = data_dir / "books.json"
    pricing_path = data_dir / "pricing_data.json"

    # 1) Database
    connector = DatabaseConnector()
    await DatabaseInitializer().init(connector)  # creates tables
    crud = Crud(connector)
    repo = Repository(crud)

    # 2) Services
    context_service = ContextService(repo)
    cache_service = TTLCache(default_ttl_seconds=60)
    pricing_service = PricingService(pricing_path)
    openai_gateway = OpenAIGateway()
    rag_service = BookRAG(books_path)
    pipeline = ChatPipeline(
        repo=repo,
        pricing=pricing_service,
        rag=rag_service,
        oa=openai_gateway,
        cache=cache_service,
        context=context_service,
    )

    # 3) Expose on app.state so routes can use them
    app.state.connector = connector
    app.state.repo = repo
    app.state.context = context_service
    app.state.cache = cache_service
    app.state.pricing = pricing_service
    app.state.oa = openai_gateway
    app.state.rag = rag_service
    app.state.pipeline = pipeline
    app.state.books_path = books_path
    app.state.pricing_path = pricing_path

    yield


app = FastAPI(
    title="Book Chat Backend",
    lifespan=lifespan,
)


@app.post("/chat/", response_model=SendMessageResponse)
async def send_message_with_files(
    text: str = Form(...),
    model: str = Form(default="gpt-4.1-nano"),
    conversation_id: Optional[int] = Form(default=None),
    files: List[UploadFile] = File(default=[]),
):
    """Handle message sending with optional file attachments"""
    if not text.strip():
        raise HTTPException(400, "Empty text")

    # First, send the message through the pipeline
    result = await app.state.pipeline.handle_user_message(
        conversation_id=conversation_id,
        user_text=text,
        model=model,
    )

    # If files were uploaded, attach them to the user message
    if files:
        request_message_id = result["request_message_id"]
        for file in files:
            if file.filename:
                content = await file.read()
                await app.state.repo.add_attachment(
                    message_id=request_message_id,
                    filename=file.filename,
                    content=content,
                    content_type=file.content_type,
                )

    return SendMessageResponse(
        conversation_id=result["conversation_id"],
        request_message_id=result["request_message_id"],
        response_message_id=result["response_message_id"],
        answer=result["answer"],
    )


@app.get("/chat/{conversation_id}/usage-details")
async def get_conversation_usage_details(conversation_id: int):
    """Get detailed usage breakdown for all messages in a conversation"""
    usage_details = await app.state.repo.get_usage_details_for_conversation(conversation_id)
    return {"usage_details": [ud.model_dump() for ud in usage_details]}


@app.post("/conversations/", response_model=int)
async def create_conversation_endpoint(conversation: ConversationCreate):
    conv = await app.state.repo.create_conversation(conversation)
    return conv.id


@app.put("/conversations/{conversation_id}/rename")
async def rename_conversation_endpoint(conversation_id: int, new_title: str):
    ok = await app.state.repo.rename_conversation(conversation_id, new_title)
    if not ok:
        raise HTTPException(404, "Conversation not found")
    return {"detail": "Conversation renamed successfully"}


@app.get("/conversations/", response_model=List[ConversationOut])
async def get_conversations_endpoint():
    convs = await app.state.repo.list_conversations()
    return [ConversationOut(**c.model_dump()) for c in convs]


@app.delete("/conversations/{conversation_id}")
async def delete_conversation_endpoint(conversation_id: int):
    ok = await app.state.repo.delete_conversation(conversation_id)
    if not ok:
        raise HTTPException(404, "Conversation not found")
    return {"detail": "Conversation deleted"}


@app.get(
    "/conversations/{conversation_id}/messages", response_model=ConversationMessages
)
async def get_conversation_messages_endpoint(conversation_id: int):
    conv = await app.state.repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    page = await app.state.repo.list_messages(conversation_id, offset=0, limit=10_000)
    return ConversationMessages(conversation_id=conversation_id, messages=page.items)


@app.get("/chat/messages/{message_id}/usage-details")
async def get_message_usage_details(message_id: int):
    """Get detailed usage breakdown for a specific message"""
    result = await app.state.repo.get_message_with_usage_details(message_id)
    if not result:
        raise HTTPException(404, "Message not found")
    return result.model_dump()


@app.get("/conversations/{conversation_id}/context", response_model=str)
async def get_conversation_context_endpoint(conversation_id: int):
    conv = await app.state.repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    compact = await app.state.context.get_compact_conversation_context(
        conversation_id, max_messages=50, prefer_summaries=True
    )
    # Return a compact string: role: content\n---\nrole: content...
    lines = []
    for m in compact:
        role = m.get("role", "user")
        content = (m.get("content") or "").strip()
        lines.append(f"{role}: {content}")
    return "\n---\n".join(lines)


@app.get("/models", response_model=dict)
async def get_models_endpoint():
    return get_available_models_from_pricing(app.state.pricing_path)


@app.get("/attachments/{attachment_id}")
async def download_attachment(attachment_id: int):
    meta = await app.state.repo.get_attachment_meta(attachment_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Attachment not found")
    blob = await app.state.repo.get_attachment_blob(attachment_id)
    if blob is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return Response(
        blob,
        media_type=meta.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{meta.filename}"'},
    )
