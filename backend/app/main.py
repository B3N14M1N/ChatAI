from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional
import hashlib

from fastapi import FastAPI, HTTPException, Response, Form, File, UploadFile, Depends
from pydantic import BaseModel

from app.db.connector import DatabaseConnector
from app.db.initializer import DatabaseInitializer
from app.db.crud import Crud
from app.db.repository import Repository
from app.models.schemas import ConversationCreate
from app.models.schemas import WorkCreate, Work
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
    RegisterRequest,
    LoginRequest,
)
from app.services.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.services.validation import PasswordValidator, EmailValidator
from fastapi.security import OAuth2PasswordRequestForm


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

    # After services are ready, ensure dataset books exist in SQL (idempotent)
    try:
        data = []
        if books_path.exists():
            import json
            data = json.loads(books_path.read_text(encoding="utf-8"))
        for item in data:
            title = item.get("title")
            author = item.get("author")
            year = str(item.get("year") or "") or None
            genres = item.get("genres", [])
            themes = item.get("themes", [])
            short_summary = item.get("short_summary")
            full_summary = item.get("full_summary")
            # Deterministic rag id based on title+author
            base = f"{title}|{author or ''}"
            rid = hashlib.sha1(base.encode("utf-8")).hexdigest()
            await repo.ensure_work_exists(
                title=title,
                author=author,
                year=year,
                short_summary=short_summary,
                full_summary=full_summary,
                image_url=item.get("image_url"),
                genres=genres,
                themes=themes,
                rag_id=rid,
            )
    except Exception as e:
        # Do not fail startup on sync issues
        print(f"Dataset sync error: {e}")

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
    current_user=Depends(get_current_user),
):
    """Handle message sending with optional file attachments"""
    if not text.strip():
        raise HTTPException(400, "Empty text")

    # First, send the message through the pipeline
    result = await app.state.pipeline.handle_user_message(
        conversation_id=conversation_id,
        user_text=text,
        model=model,
        user_id=current_user["id"],
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
    response_message_id=result.get("response_message_id"),
    answer=result.get("answer"),
    )


@app.get("/chat/{conversation_id}/usage-details")
async def get_conversation_usage_details(conversation_id: int):
    """Get detailed usage breakdown for all messages in a conversation"""
    usage_details = await app.state.repo.get_usage_details_for_conversation(conversation_id)
    return {"usage_details": [ud.model_dump() for ud in usage_details]}


@app.post("/conversations/", response_model=int)
async def create_conversation_endpoint(conversation: ConversationCreate, current_user=Depends(get_current_user)):
    conv = await app.state.repo.create_conversation(conversation, user_id=current_user["id"])
    return conv.id


@app.post("/auth/register", response_model=dict)
async def register_user(payload: RegisterRequest):
    """User registration with validation"""
    crud = app.state.repo.crud
    
    # Validate email format
    email_result = EmailValidator.validate_email(payload.email)
    if not email_result.is_valid:
        # Return the first error message directly
        raise HTTPException(
            status_code=400,
            detail=email_result.errors[0]
        )
    
    # Validate password strength
    password_result = PasswordValidator.validate_password(payload.password)
    if not password_result.is_valid:
        # Return the first error message directly
        raise HTTPException(
            status_code=400,
            detail=password_result.errors[0]
        )
    
    # Check if email already exists
    existing = await crud.get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    password_hash = get_password_hash(payload.password)
    uid = await crud.create_user(payload.email, password_hash, payload.display_name)
    token = create_access_token({"sub": str(uid), "email": payload.email})
    
    return {"access_token": token, "token_type": "bearer"}


@app.post("/auth/token", response_model=dict)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # Expect form with 'username' (email) and 'password'
    username = form_data.username
    password = form_data.password
    crud = app.state.repo.crud
    user = await crud.get_user_by_email(username)
    if not user or not verify_password(password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = create_access_token({"sub": str(user["id"]), "email": user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/auth/login", response_model=dict)
async def login_json(payload: LoginRequest):
    """User login with email validation"""
    # Validate email format
    email_result = EmailValidator.validate_email(payload.email)
    if not email_result.is_valid:
        # Return the first error message directly
        raise HTTPException(
            status_code=400,
            detail=email_result.errors[0]
        )
    
    crud = app.state.repo.crud
    user = await crud.get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = create_access_token({"sub": str(user["id"]), "email": user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/auth/password-requirements")
async def get_password_requirements():
    """Get password requirements for frontend validation"""
    return {
        "requirements": PasswordValidator.get_password_requirements(),
        "config": {
            "minLength": 8,
            "requireNumber": True,
            "requireSymbol": True
        }
    }


@app.get("/users/me")
async def read_users_me(current_user=Depends(get_current_user)):
    return current_user


class UpdateMePayload(BaseModel):
    email: Optional[str] = None
    display_name: Optional[str] = None


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


@app.put("/users/me")
async def update_me(payload: UpdateMePayload, current_user=Depends(get_current_user)):
    crud = app.state.repo.crud
    # If email changes, ensure uniqueness
    new_email = payload.email
    if new_email and new_email != current_user.get("email"):
        exists = await crud.get_user_by_email(new_email)
        if exists:
            raise HTTPException(status_code=400, detail="Email already registered")
    updated = await crud.update_user(current_user["id"], email=new_email, display_name=payload.display_name)
    if not updated:
        raise HTTPException(400, "Failed to update profile")
    # Return refreshed user
    user_row = await crud.get_user(current_user["id"])
    return user_row


@app.put("/users/me/password")
async def change_password(payload: ChangePasswordPayload, current_user=Depends(get_current_user)):
    crud = app.state.repo.crud
    # Load full user with password hash
    full = await crud.get_user_with_hash(current_user["id"]) 
    if not full or not verify_password(payload.current_password, full.get("password_hash")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    # Optional: validate new password strength using PasswordValidator
    pw_check = PasswordValidator.validate_password(payload.new_password)
    if not pw_check.is_valid:
        raise HTTPException(status_code=400, detail=pw_check.errors[0])
    new_hash = get_password_hash(payload.new_password)
    ok = await crud.update_user_password(current_user["id"], new_hash)
    if not ok:
        raise HTTPException(400, detail="Failed to change password")
    return {"detail": "Password changed"}


@app.put("/conversations/{conversation_id}/rename")
async def rename_conversation_endpoint(conversation_id: int, new_title: str, current_user=Depends(get_current_user)):
    ok = await app.state.repo.rename_conversation(conversation_id, new_title, user_id=current_user["id"])
    if not ok:
        raise HTTPException(404, "Conversation not found")
    return {"detail": "Conversation renamed successfully"}


@app.get("/conversations/", response_model=List[ConversationOut])
async def get_conversations_endpoint(current_user=Depends(get_current_user)):
    convs = await app.state.repo.list_conversations(user_id=current_user["id"])
    return [ConversationOut(**c.model_dump()) for c in convs]


@app.delete("/conversations/{conversation_id}")
async def delete_conversation_endpoint(conversation_id: int, current_user=Depends(get_current_user)):
    # Ensure ownership
    conv = await app.state.repo.get_conversation(conversation_id, user_id=current_user["id"])
    if not conv:
        raise HTTPException(404, "Conversation not found")
    ok = await app.state.repo.delete_conversation(conversation_id)
    if not ok:
        raise HTTPException(404, "Conversation not found")
    return {"detail": "Conversation deleted"}


@app.get(
    "/conversations/{conversation_id}/messages", response_model=ConversationMessages
)
async def get_conversation_messages_endpoint(conversation_id: int, current_user=Depends(get_current_user)):
    conv = await app.state.repo.get_conversation(conversation_id, user_id=current_user["id"])
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

# ---------------- Works (Library) ----------------
@app.get("/works", response_model=list[Work])
async def list_works(q: str | None = None, author: str | None = None, year: str | None = None, genres: str | None = None, themes: str | None = None, current_user=Depends(get_current_user)):
    g_list = [g.strip() for g in (genres.split(",") if genres else []) if g.strip()]
    t_list = [t.strip() for t in (themes.split(",") if themes else []) if t.strip()]
    rows = await app.state.repo.list_works(q=q, author=author, year=year, genres=g_list or None, themes=t_list or None)
    return [Work(**w.model_dump()) for w in rows]


@app.post("/works", response_model=Work)
async def create_work(payload: WorkCreate, current_user=Depends(get_current_user)):
    # Insert into RAG first to get rag_id
    # Build rich doc text similar to rag ingestion
    text = f"""Title: {payload.title}
Author: {payload.author or ''}
Year: {payload.year or ''}
Genres: {', '.join(payload.genres)}
Themes: {', '.join(payload.themes)}
Summary: {payload.short_summary or ''}
{payload.full_summary or ''}"""
    # Upsert into Chroma
    rag = app.state.rag
    # Deterministic rag id by title+author
    base = f"{payload.title}|{payload.author or ''}"
    rid = hashlib.sha1(base.encode("utf-8")).hexdigest()
    rag.collection.add(ids=[rid], documents=[text], metadatas=[{
        "title": payload.title,
        "author": payload.author or "",
        "year": str(payload.year or ""),
        "genres": payload.genres,
        "themes": payload.themes,
        "short_summary": payload.short_summary or "",
        "full_summary": payload.full_summary or "",
    }])
    # Save in SQL and link tags
    work = await app.state.repo.create_work(payload, genres=payload.genres, themes=payload.themes, rag_id=rid)
    return work


@app.get("/works/{work_id}", response_model=Work)
async def get_work(work_id: int, current_user=Depends(get_current_user)):
    work = await app.state.repo.get_work(work_id)
    if not work:
        raise HTTPException(404, "Work not found")
    return work


@app.put("/works/{work_id}", response_model=Work)
async def update_work(work_id: int, payload: WorkCreate, current_user=Depends(get_current_user)):
    # Update RAG doc as well: delete + add with same deterministic id
    base = f"{payload.title}|{payload.author or ''}"
    rid = hashlib.sha1(base.encode("utf-8")).hexdigest()
    text = f"""Title: {payload.title}
Author: {payload.author or ''}
Year: {payload.year or ''}
Genres: {', '.join(payload.genres)}
Themes: {', '.join(payload.themes)}
Summary: {payload.short_summary or ''}
{payload.full_summary or ''}"""
    rag = app.state.rag
    try:
        # remove old by id if exists
        rag.collection.delete(ids=[rid])
    except Exception:
        pass
    rag.collection.add(ids=[rid], documents=[text], metadatas=[{
        "title": payload.title,
        "author": payload.author or "",
        "year": str(payload.year or ""),
        "genres": payload.genres,
        "themes": payload.themes,
        "short_summary": payload.short_summary or "",
        "full_summary": payload.full_summary or "",
    }])
    updated = await app.state.repo.update_work(work_id, payload, genres=payload.genres, themes=payload.themes, rag_id=rid)
    if not updated:
        raise HTTPException(404, "Work not found")
    return updated
