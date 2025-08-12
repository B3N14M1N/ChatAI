from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Union, Dict
from datetime import datetime
from enum import Enum


# Enums for better type safety
class SenderType(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class ContentType(str, Enum):
    TEXT_PLAIN = "text/plain"
    APPLICATION_PDF = "application/pdf"
    IMAGE_JPEG = "image/jpeg"
    IMAGE_PNG = "image/png"
    APPLICATION_JSON = "application/json"
    APPLICATION_OCTET_STREAM = "application/octet-stream"


# Usage metrics schema
class UsageMetrics(BaseModel):
    input_tokens: Optional[int] = Field(None, ge=0, description="Number of input tokens")
    output_tokens: Optional[int] = Field(None, ge=0, description="Number of output tokens")
    cached_tokens: Optional[int] = Field(None, ge=0, description="Number of cached tokens")
    model: Optional[str] = Field(None, description="Model used for generation")
    price: Optional[float] = Field(None, ge=0, description="Cost in USD")


# Attachment schemas
class AttachmentCreate(BaseModel):
    filename: str = Field(..., min_length=1, description="Name of the attached file")
    content_type: str = Field(..., description="MIME type of the file")
    

class AttachmentOut(BaseModel):
    id: int
    message_id: int
    filename: str
    content_type: str

    class Config:
        from_attributes = True


class AttachmentDownload(AttachmentOut):
    content: bytes = Field(..., description="Binary content of the file")


# Message schemas
class MessageCreate(BaseModel):
    conversation_id: Optional[int] = Field(None, description="ID of the conversation")
    text: str = Field(..., min_length=1, description="Message content")
    summary: Optional[str] = Field(None, description="Short summary of the message")
    request_id: Optional[int] = Field(None, description="ID of the request message (for responses)")
    attachments: Optional[List[str]] = Field(None, description="List of attachment filenames")
    
    # Usage metrics embedded
    input_tokens: Optional[int] = Field(None, ge=0)
    output_tokens: Optional[int] = Field(None, ge=0)
    cached_tokens: Optional[int] = Field(None, ge=0)
    model: Optional[str] = "gpt-4.1"
    price: Optional[float] = Field(None, ge=0)


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    request_id: Optional[int] = None
    text: Optional[str]
    summary: Optional[str] = None
    created_at: str
    
    # Usage metrics
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cached_tokens: Optional[int] = None
    model: Optional[str] = None
    price: Optional[float] = None
    
    # Attachments
    attachments: Optional[List[AttachmentOut]] = None

    @property
    def sender(self) -> SenderType:
        """Determine sender based on request_id: None = user, not None = assistant"""
        return SenderType.USER if self.request_id is None else SenderType.ASSISTANT
    
    @property
    def display_text(self) -> str:
        """Get display text: summary with ID if available, otherwise full text"""
        if self.summary:
            return f"[ID: {self.id}] {self.summary}"
        return self.text or ""
    
    @property
    def usage_metrics(self) -> UsageMetrics:
        """Get usage metrics as a structured object"""
        return UsageMetrics(
            input_tokens=self.input_tokens,
            output_tokens=self.output_tokens,
            cached_tokens=self.cached_tokens,
            model=self.model,
            price=self.price
        )

    class Config:
        from_attributes = True


# User-specific message creation schemas
class UserMessageCreate(BaseModel):
    conversation_id: int
    text: str = Field(..., min_length=1)
    summary: Optional[str] = None
    attachments: Optional[List[str]] = None


class AssistantResponseCreate(BaseModel):
    conversation_id: int
    request_id: int = Field(..., description="ID of the user message this responds to")
    text: str = Field(..., min_length=1)
    summary: Optional[str] = None
    usage_metrics: Optional[UsageMetrics] = None


# Message summary for conversation context
class MessageSummary(BaseModel):
    id: int
    sender: SenderType
    text: str = Field(..., description="Display text (summary or full content)")
    created_at: str
    request_id: Optional[int] = None

    class Config:
        from_attributes = True



# Conversation schemas
class ConversationCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=255, description="Optional conversation title")


class ConversationOut(BaseModel):
    id: int
    title: Optional[str]
    summary: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class ConversationUpdate(BaseModel):
    conversation_id: int = Field(..., gt=0)
    new_title: str = Field(..., min_length=1, max_length=255)


class ConversationMessages(BaseModel):
    conversation_id: int
    messages: List[MessageOut]

    @property
    def message_count(self) -> int:
        return len(self.messages)
    
    @property
    def user_message_count(self) -> int:
        return sum(1 for msg in self.messages if msg.sender == SenderType.USER)
    
    @property
    def assistant_message_count(self) -> int:
        return sum(1 for msg in self.messages if msg.sender == SenderType.ASSISTANT)


class ConversationSummary(BaseModel):
    conversation_id: int
    messages: List[MessageSummary]

    @property
    def message_count(self) -> int:
        return len(self.messages)


# Chat-specific schemas
class ChatRequest(UserMessageCreate):
    """Request schema for chat endpoint"""
    pass


class ChatResponse(MessageOut):
    """Response schema for chat endpoint with usage metrics"""
    
    class Config:
        from_attributes = True


# Book recommendation schemas
class BookRecommendationInput(BaseModel):
    genre: str = Field(..., min_length=1, description="Book genre to search for")
    top_k: int = Field(5, ge=1, le=20, description="Number of recommendations to return")


class BooksSummariesInput(BaseModel):
    titles: List[str] = Field(..., min_items=1, description="List of book titles to summarize")


class BookRecommendationOutput(BaseModel):
    title: str
    author: str
    short_summary: str

    class Config:
        from_attributes = True


# Pricing and model schemas
class ModelPricing(BaseModel):
    input: float = Field(..., ge=0, description="Price per million input tokens")
    output: float = Field(..., ge=0, description="Price per million output tokens")
    cached_input: Optional[float] = Field(None, ge=0, description="Price per million cached input tokens")


class ModelInfo(BaseModel):
    name: str = Field(..., description="Model identifier")
    pricing: ModelPricing
    context_window: Optional[int] = Field(None, gt=0, description="Maximum context window size")
    description: Optional[str] = None

    class Config:
        from_attributes = True


class ModelsResponse(BaseModel):
    """Response containing available models and their information"""
    models: Dict[str, ModelInfo]

    class Config:
        from_attributes = True


# Statistics and analytics schemas
class ConversationStats(BaseModel):
    total_messages: int = Field(..., ge=0)
    user_messages: int = Field(..., ge=0)
    assistant_messages: int = Field(..., ge=0)
    total_tokens_used: Optional[int] = Field(None, ge=0)
    total_cost: Optional[float] = Field(None, ge=0)
    models_used: List[str] = Field(default_factory=list)


class MessageStats(BaseModel):
    id: int
    token_count: Optional[int] = None
    cost: Optional[float] = None
    model: Optional[str] = None
    has_attachments: bool = False
    attachment_count: int = Field(default=0, ge=0)


# Error response schemas
class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None


class ValidationErrorResponse(BaseModel):
    detail: List[dict]
    error_code: str = "validation_error"
