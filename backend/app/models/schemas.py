from __future__ import annotations
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

# Core entities


class Conversation(BaseModel):
    id: int
    title: Optional[str] = None
    summary: Optional[str] = None
    created_at: str


class ConversationCreate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None


Role = Literal["user", "assistant"]


class Message(BaseModel):
    id: int
    conversation_id: int
    request_id: Optional[int] = None
    # Derived convenience: role (not stored directly)
    role: Role = Field(default="user")
    text: Optional[str] = None
    summary: Optional[str] = None
    created_at: str
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cached_tokens: Optional[int] = None
    model: Optional[str] = None
    price: Optional[float] = None


class MessageCreate(BaseModel):
    conversation_id: int
    # request_id: If None => user message; if set => assistant response to message_id=request_id
    request_id: Optional[int] = None
    text: Optional[str] = None
    summary: Optional[str] = None
    # usage/metrics (optional at creation; can be set later)
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cached_tokens: Optional[int] = None
    model: Optional[str] = None
    price: Optional[float] = None


class MessageUpdate(BaseModel):
    text: Optional[str] = None
    summary: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cached_tokens: Optional[int] = None
    model: Optional[str] = None
    price: Optional[float] = None


class Attachment(BaseModel):
    id: int
    message_id: int
    filename: str
    content_type: Optional[str] = None


class AttachmentCreate(BaseModel):
    message_id: int
    filename: str
    content: bytes
    content_type: Optional[str] = None


class RequestResponsePair(BaseModel):
    """A pair of (user request, assistant response). Response may be None if pending."""

    request: Message
    response: Optional[Message] = None


class PaginatedMessages(BaseModel):
    items: List[Message]
    total: int
    offset: int
    limit: int
