from typing import Optional, List
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
    UsageDetail,
    UsageDetailCreate,
    MessageWithUsageDetails,
    Work,
    WorkCreate,
)


def _derive_role(request_id: Optional[int]) -> str:
    return "user" if request_id is None else "assistant"


class Repository:
    def __init__(self, crud: Crud):
        self.crud = crud

    # Conversations
    async def create_conversation(self, data: ConversationCreate, user_id: int) -> Conversation:
        cid = await self.crud.create_conversation_for_user(user_id, data.title, data.summary)
        row = await self.crud.get_conversation(cid)
        return Conversation(**row)

    async def get_conversation(self, conversation_id: int, user_id: Optional[int] = None) -> Optional[Conversation]:
        row = await self.crud.get_conversation(conversation_id)
        if not row:
            return None
        # Verify ownership if user_id supplied
        if user_id is not None and row.get("user_id") != user_id:
            return None
        return Conversation(**row)

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

    async def list_conversations(self, user_id: Optional[int] = None) -> list[Conversation]:
        if user_id is None:
            rows = await self.crud.list_conversations()
        else:
            rows = await self.crud.list_conversations_for_user(user_id)
        return [Conversation(**r) for r in rows]

    async def rename_conversation(self, conversation_id: int, new_title: str, user_id: Optional[int] = None) -> bool:
        # Optionally enforce ownership: ensure conversation belongs to user_id before renaming
        if user_id is not None:
            row = await self.crud.get_conversation(conversation_id)
            if not row or row.get("user_id") != user_id:
                return False
        return await self.crud.rename_conversation(conversation_id, new_title)

    async def get_messages_for_conversation(
        self, conversation_id: int
    ) -> list[Message]:
        # full history for UI; ordered ASC (already in list_messages)
        page = await self.list_messages(conversation_id, offset=0, limit=10_000)
        return page.items

    # Usage Details
    async def create_usage_detail(self, data: UsageDetailCreate) -> UsageDetail:
        """Create a new usage detail record"""
        uid = await self.crud.create_usage_detail(data.model_dump())
        row = await self.crud.get_usage_details_for_message(data.message_id)
        # Find the newly created record
        usage_detail = next(r for r in row if r["id"] == uid)
        return UsageDetail(**usage_detail)

    async def get_usage_details_for_message(self, message_id: int) -> List[UsageDetail]:
        """Get all usage details for a specific message"""
        rows = await self.crud.get_usage_details_for_message(message_id)
        return [UsageDetail(**r) for r in rows]

    async def get_message_with_usage_details(self, message_id: int) -> Optional[MessageWithUsageDetails]:
        """Get a message with its detailed usage breakdown"""
        message_row = await self.crud.get_message(message_id)
        if not message_row:
            return None
        
        message_row["role"] = _derive_role(message_row.get("request_id"))
        message = Message(**message_row)
        
        usage_details = await self.get_usage_details_for_message(message_id)
        
        return MessageWithUsageDetails(
            message=message,
            usage_details=usage_details
        )

    async def get_usage_details_for_conversation(self, conversation_id: int) -> List[UsageDetail]:
        """Get all usage details for all messages in a conversation"""
        rows = await self.crud.get_usage_details_for_conversation(conversation_id)
        return [UsageDetail(**r) for r in rows]

    # Works / Tags
    async def create_work(self, data: WorkCreate, *, genres: list[str], themes: list[str], rag_id: str | None = None) -> Work:
        work_id = await self.crud.create_work({
            "title": data.title,
            "author": data.author,
            "year": data.year,
            "short_summary": data.short_summary,
            "full_summary": data.full_summary,
            "image_url": data.image_url,
            "rag_id": rag_id,
        })
        # Upsert tags, then link
        tag_ids: list[int] = []
        for name in genres:
            tid = await self.crud.upsert_tag(name, "genre")
            tag_ids.append(tid)
        for name in themes:
            tid = await self.crud.upsert_tag(name, "theme")
            tag_ids.append(tid)
        await self.crud.set_work_tags(work_id, tag_ids)
        # Re-fetch via list to include tags
        rows = await self.crud.list_works()
        row = next(w for w in rows if w["id"] == work_id)
        return Work(**row)

    async def list_works(self, *, q: str | None = None, author: str | None = None, year: str | None = None, genres: list[str] | None = None, themes: list[str] | None = None) -> list[Work]:
        rows = await self.crud.list_works(q=q, author=author, year=year, genres=genres, themes=themes)
        return [Work(**r) for r in rows]

    async def get_work(self, work_id: int) -> Optional[Work]:
        row = await self.crud.get_work_basic_by_id(work_id)
        if not row:
            return None
        # fetch tags via list_works to include genres/themes
        rows = await self.crud.list_works()
        match = next((r for r in rows if r["id"] == work_id), None)
        return Work(**match) if match else Work(**row)

    async def update_work(self, work_id: int, data: WorkCreate, *, genres: list[str], themes: list[str], rag_id: str | None = None) -> Optional[Work]:
        await self.crud.update_work(work_id, {
            "title": data.title,
            "author": data.author,
            "year": data.year,
            "short_summary": data.short_summary,
            "full_summary": data.full_summary,
            "image_url": data.image_url,
            "rag_id": rag_id,
        })
        tag_ids: list[int] = []
        for name in genres:
            tid = await self.crud.upsert_tag(name, "genre")
            tag_ids.append(tid)
        for name in themes:
            tid = await self.crud.upsert_tag(name, "theme")
            tag_ids.append(tid)
        await self.crud.set_work_tags(work_id, tag_ids)
        # return updated
        rows = await self.crud.list_works()
        row = next((w for w in rows if w["id"] == work_id), None)
        return Work(**row) if row else None

    async def delete_work(self, work_id: int) -> Optional[Work]:
        # Work_tags has ON DELETE CASCADE; tags remain globally.
        rows = await self.crud.list_works()
        row = next((w for w in rows if w["id"] == work_id), None)
        if row:
            await self.crud.delete_work(work_id)
        return Work(**row) if row else None

    # Work cover images
    async def set_work_cover(self, work_id: int, content: bytes, content_type: str = "image/png") -> Optional[Work]:
        # Create a new version and set as current (also syncs legacy table)
        await self.crud.create_work_image_version(work_id, content, content_type, set_current=True)
        # Update image_url to point to our endpoint (cache-bust with timestamp)
        import time
        url = f"/works/{work_id}/image?ts={int(time.time())}"
        await self.crud.update_work(work_id, {"image_url": url})
        # Return updated work
        rows = await self.crud.list_works()
        row = next((w for w in rows if w["id"] == work_id), None)
        return Work(**row) if row else None

    async def clear_work_cover(self, work_id: int) -> Optional[Work]:
        # Soft delete current version and clear legacy image
        await self.crud.soft_delete_current_work_image(work_id)
        await self.crud.update_work(work_id, {"image_url": None})
        rows = await self.crud.list_works()
        row = next((w for w in rows if w["id"] == work_id), None)
        return Work(**row) if row else None

    async def get_work_cover_blob(self, work_id: int) -> Optional[tuple[bytes, str]]:
        # Prefer versions table (current), fallback to legacy
        blob = await self.crud.get_current_work_image_from_versions(work_id)
        if blob:
            return blob
        return await self.crud.get_work_image(work_id)

    # Versions APIs
    async def list_work_image_versions(self, work_id: int, include_deleted: bool = False) -> list[dict]:
        return await self.crud.list_work_image_versions(work_id, include_deleted)

    async def set_current_work_image_version(self, work_id: int, version_id: int) -> Optional[Work]:
        ok = await self.crud.set_current_work_image_version(work_id, version_id)
        if not ok:
            return None
        # Refresh image_url
        import time
        url = f"/works/{work_id}/image?ts={int(time.time())}"
        await self.crud.update_work(work_id, {"image_url": url})
        rows = await self.crud.list_works()
        row = next((w for w in rows if w["id"] == work_id), None)
        return Work(**row) if row else None

    async def ensure_work_exists(self, *, title: str, author: Optional[str], year: Optional[str], short_summary: Optional[str], full_summary: Optional[str], image_url: Optional[str], genres: list[str], themes: list[str], rag_id: Optional[str]) -> Work:
        # Try by title/author/year
        existing = await self.crud.get_work_by_title_author_year(title, author, year)
        if existing:
            return Work(**existing)
        # else create
        wc = WorkCreate(
            title=title,
            author=author,
            year=year,
            short_summary=short_summary,
            full_summary=full_summary,
            image_url=image_url,
            genres=genres,
            themes=themes,
        )
        return await self.create_work(wc, genres=genres, themes=themes, rag_id=rag_id)
