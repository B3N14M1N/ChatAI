from pydantic import BaseModel
from typing import Optional, List


class ConversationCreate(BaseModel):
    title: Optional[str] = None

class ConversationOut(BaseModel):
    id: int
    title: Optional[str]
    created_at: str

class MessageCreate(BaseModel):
    conversation_id: Optional[int]
    sender: str
    text: str
    metadata: Optional[str] = None

class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender: str
    text: Optional[str]
    created_at: str
    metadata: Optional[str] = None

class ConversationMessages(BaseModel):
    conversation_id: int
    messages: List[MessageOut]


class ChatRequest(MessageCreate):
    model: str = "gpt-4.1"

class ChatResponse(MessageOut):
    model: str