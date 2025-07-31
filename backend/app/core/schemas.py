from pydantic import BaseModel
from typing import Optional, List


class ConversationCreate(BaseModel):
    title: Optional[str] = None

class ConversationUpdate(BaseModel):
    conversation_id: int
    new_title: str

class ConversationOut(BaseModel):
    id: int
    title: Optional[str]
    created_at: str

class MessageCreate(BaseModel):
    conversation_id: Optional[int]
    sender: str
    text: str
    metadata: Optional[str] = None
    # Usage metrics
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    model: Optional[str] = "gpt-4.1"
    price: Optional[float] = None

class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender: str
    text: Optional[str]
    created_at: str
    metadata: Optional[str] = None
    # Usage metrics
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    model: Optional[str] = None
    price: Optional[float] = None

class ConversationMessages(BaseModel):
    conversation_id: int
    messages: List[MessageOut]


class ChatRequest(MessageCreate):
    pass

class ChatResponse(MessageOut):
    """
    Response returned by /chat includes message fields with usage metrics.
    """