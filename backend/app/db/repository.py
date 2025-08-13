from typing import Optional, List, Tuple
from datetime import datetime
from .crud import Crud
from ..models.schemas import (
    Conversation,
    ConversationCreate,
    ConversationUpdate,
    Message,
    MessageCreate,
    MessageUpdate,
    Attachment,
    RequestResponsePair,
    PaginatedMessages,
)


def _derive_role(request_id: Optional[int]) -> str:
    return "user" if request_id is None else "assistant"


class Repository:
    def __init__(self, crud: Crud):
        self.crud = crud

    # Conversations
    async def create_conversation(self, data: ConversationCreate) -> Conversation:
        cid = await self.crud.create_conversation(data.title, data.summary)
        row = await self.crud.get_conversation(cid)
        return Conversation(**row)

    async def get_conversation(self, conversation_id: int) -> Optional[Conversation]:
        row = await self.crud.get_conversation(conversation_id)
        return Conversation(**row) if row else None

    async def update_conversation(
        self, conversation_id: int, data: ConversationUpdate
    ) -> bool:
        return await self.crud.update_conversation(
            conversation_id, data.title, data.summary
        )

    async def delete_conversation(self, conversation_id: int) -> bool:
        return await self.crud.delete_conversation(conversation_id)

    # Messages
    async def create_message(self, data: MessageCreate) -> Message:
        mid = await self.crud.create_message(data.model_dump())
        row = await self.crud.get_message(mid)
        row["role"] = _derive_role(row.get("request_id"))
        return Message(**row)

    async def get_message(self, message_id: int) -> Optional[Message]:
        row = await self.crud.get_message(message_id)
        if not row:
            return None
        row["role"] = _derive_role(row.get("request_id"))
        return Message(**row)

    async def list_messages(
        self, conversation_id: int, offset: int = 0, limit: int = 50
    ) -> PaginatedMessages:
        items, total = await self.crud.list_messages(
            conversation_id, offset=offset, limit=limit
        )
        for r in items:
            r["role"] = _derive_role(r.get("request_id"))
        return PaginatedMessages(
            items=[Message(**r) for r in items], total=total, offset=offset, limit=limit
        )

    async def update_message(self, message_id: int, data: MessageUpdate) -> bool:
        return await self.crud.update_message(
            message_id, {k: v for k, v in data.model_dump().items() if v is not None}
        )

    async def set_message_usage(
        self,
        message_id: int,
        *,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        cached_tokens: Optional[int] = None,
        model: Optional[str] = None,
        price: Optional[float] = None,
    ) -> bool:
        payload = {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cached_tokens": cached_tokens,
            "model": model,
            "price": price,
        }
        payload = {k: v for k, v in payload.items() if v is not None}
        return await self.crud.update_message(message_id, payload)

    async def delete_message(self, message_id: int) -> bool:
        return await self.crud.delete_message(message_id)

    async def list_last_n_request_response_pairs(
        self, conversation_id: int, n: int
    ) -> List[RequestResponsePair]:
        pairs = await self.crud.list_last_n_request_response_pairs(conversation_id, n)
        out: List[RequestResponsePair] = []
        for req_row, resp_row in pairs:
            req_row["role"] = "user"
            req = Message(**req_row)
            resp = None
            if resp_row:
                resp_row["role"] = "assistant"
                resp = Message(**resp_row)
            out.append(RequestResponsePair(request=req, response=resp))
        return out

    # Attachments
    async def add_attachment(
        self,
        message_id: int,
        filename: str,
        content: bytes,
        content_type: Optional[str],
    ) -> int:
        return await self.crud.add_attachment(
            message_id, filename, content, content_type
        )

    async def get_attachment_meta(self, attachment_id: int) -> Optional[Attachment]:
        row = await self.crud.get_attachment_meta(attachment_id)
        return Attachment(**row) if row else None

    async def get_attachment_blob(self, attachment_id: int) -> Optional[bytes]:
        return await self.crud.get_attachment_blob(attachment_id)

    async def delete_attachment(self, attachment_id: int) -> bool:
        return await self.crud.delete_attachment(attachment_id)

    async def list_conversations(self) -> list[Conversation]:
        rows = await self.crud.list_conversations()
        return [Conversation(**r) for r in rows]

    async def rename_conversation(self, conversation_id: int, new_title: str) -> bool:
        return await self.crud.rename_conversation(conversation_id, new_title)

    async def get_messages_for_conversation(
        self, conversation_id: int
    ) -> list[Message]:
        # full history for UI; ordered ASC (already in list_messages)
        page = await self.list_messages(conversation_id, offset=0, limit=10_000)
        return page.items
