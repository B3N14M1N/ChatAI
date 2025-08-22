from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel
from .schemas import Message


class ConversationOut(BaseModel):
    id: int
    title: Optional[str] = None
    summary: Optional[str] = None
    created_at: str


class ConversationMessages(BaseModel):
    conversation_id: int
    messages: List[Message]


class SendPayload(BaseModel):
    conversation_id: Optional[int] = None
    text: str


class SendMessageResponse(BaseModel):
    conversation_id: Optional[int] = None
    request_message_id: Optional[int] = None
    response_message_id: Optional[int] = None
    answer: Optional[str] = None


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str
