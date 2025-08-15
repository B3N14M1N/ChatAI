from typing import Any, Optional, Sequence, Tuple
from .connector import DatabaseConnector


def _row_to_dict(description: Sequence[Tuple], row: Tuple[Any, ...]) -> dict:
    return {desc[0]: value for desc, value in zip(description, row)}


class Crud:
    def __init__(self, connector: DatabaseConnector):
        self.connector = connector

    # ---------- Conversations ----------
    async def create_conversation(
        self, title: Optional[str], summary: Optional[str]
    ) -> int:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "INSERT INTO conversations (title, summary) VALUES (?, ?)",
                (title, summary),
            )
            await conn.commit()
            return cur.lastrowid

    async def create_conversation_for_user(self, user_id: int, title: Optional[str], summary: Optional[str]) -> int:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "INSERT INTO conversations (user_id, title, summary) VALUES (?, ?, ?)",
                (user_id, title, summary),
            )
            await conn.commit()
            return cur.lastrowid

    async def get_conversation(self, conversation_id: int) -> Optional[dict]:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "SELECT id, user_id, title, summary, created_at FROM conversations WHERE id=?",
                (conversation_id,),
            )
            row = await cur.fetchone()
            return _row_to_dict(cur.description, row) if row else None

    async def update_conversation(
        self, conversation_id: int, title: Optional[str], summary: Optional[str]
    ) -> bool:
        async with self.connector.get_connection() as conn:
            await conn.execute(
                "UPDATE conversations SET title=COALESCE(?, title), summary=COALESCE(?, summary) WHERE id=?",
                (title, summary, conversation_id),
            )
            await conn.commit()
            return True

    async def delete_conversation(self, conversation_id: int) -> bool:
        async with self.connector.get_connection() as conn:
            await conn.execute(
                "DELETE FROM conversations WHERE id=?", (conversation_id,)
            )
            await conn.commit()
            return True

    # ---------- Messages ----------
    async def create_message(self, data: dict) -> int:
        keys = "conversation_id, request_id, text, summary, input_tokens, output_tokens, cached_tokens, model, price"
        placeholders = ",".join("?" for _ in keys.split(", "))
        values = tuple(
            data.get(k.strip())
            for k in [
                "conversation_id",
                "request_id",
                "text",
                "summary",
                "input_tokens",
                "output_tokens",
                "cached_tokens",
                "model",
                "price",
            ]
        )
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                f"INSERT INTO messages ({keys}) VALUES ({placeholders})",
                values,
            )
            await conn.commit()
            return cur.lastrowid

    async def get_message(self, message_id: int) -> Optional[dict]:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "SELECT * FROM messages WHERE id=?",
                (message_id,),
            )
            row = await cur.fetchone()
            return _row_to_dict(cur.description, row) if row else None

    async def list_messages(
        self, conversation_id: int, offset: int = 0, limit: int = 50
    ) -> Tuple[list[dict], int]:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                """
                SELECT * FROM messages
                WHERE conversation_id=?
                ORDER BY created_at ASC, id ASC
                LIMIT ? OFFSET ?
                """,
                (conversation_id, limit, offset),
            )
            rows = await cur.fetchall()
            items = [_row_to_dict(cur.description, r) for r in rows]

            cur2 = await conn.execute(
                "SELECT COUNT(*) FROM messages WHERE conversation_id=?",
                (conversation_id,),
            )
            total = (await cur2.fetchone())[0]
            return items, total

    async def update_message(self, message_id: int, data: dict) -> bool:
        fields = []
        values = []
        for k, v in data.items():
            fields.append(f"{k}=?")
            values.append(v)
        if not fields:
            return True
        values.append(message_id)
        async with self.connector.get_connection() as conn:
            await conn.execute(
                f"UPDATE messages SET {', '.join(fields)} WHERE id=?", tuple(values)
            )
            await conn.commit()
            return True

    async def delete_message(self, message_id: int) -> bool:
        async with self.connector.get_connection() as conn:
            await conn.execute("DELETE FROM messages WHERE id=?", (message_id,))
            await conn.commit()
            return True

    async def list_last_n_request_response_pairs(
        self, conversation_id: int, n: int
    ) -> list[tuple[dict, Optional[dict]]]:
        """
        Return last N (user_request, assistant_response) pairs ordered from oldest->newest of that slice.
        Heuristic:
          - user request: messages.request_id IS NULL
          - assistant response: messages.request_id == user_message.id (may be None if missing)
        """
        async with self.connector.get_connection() as conn:
            # Get last N user requests (most recent first)
            cur = await conn.execute(
                """
                SELECT id FROM messages
                WHERE conversation_id=? AND request_id IS NULL
                ORDER BY created_at DESC, id DESC
                LIMIT ?
                """,
                (conversation_id, n),
            )
            request_ids = [r[0] for r in await cur.fetchall()]
            if not request_ids:
                return []
            # We'll fetch their responses, if any
            placeholders = ",".join("?" for _ in request_ids)
            cur2 = await conn.execute(
                f"""
                SELECT * FROM messages
                WHERE id IN ({placeholders})
                """,
                tuple(request_ids),
            )
            req_rows = [
                _row_to_dict(cur2.description, r) for r in await cur2.fetchall()
            ]
            # Fetch responses
            cur3 = await conn.execute(
                f"""
                SELECT * FROM messages
                WHERE request_id IN ({placeholders})
                """,
                tuple(request_ids),
            )
            resp_rows = [
                _row_to_dict(cur3.description, r) for r in await cur3.fetchall()
            ]
            # Map response by request_id
            resp_by_req = {r["request_id"]: r for r in resp_rows}
            # Sort back to oldest->newest in this slice
            req_rows_sorted = sorted(req_rows, key=lambda x: (x["created_at"], x["id"]))
            return [(req, resp_by_req.get(req["id"])) for req in req_rows_sorted]

    # ---------- Attachments ----------
    async def add_attachment(
        self,
        message_id: int,
        filename: str,
        content: bytes,
        content_type: Optional[str],
    ) -> int:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "INSERT INTO attachments (message_id, filename, content, content_type) VALUES (?, ?, ?, ?)",
                (message_id, filename, content, content_type),
            )
            await conn.commit()
            return cur.lastrowid

    async def get_attachment_meta(self, attachment_id: int) -> Optional[dict]:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "SELECT id, message_id, filename, content_type FROM attachments WHERE id=?",
                (attachment_id,),
            )
            row = await cur.fetchone()
            return _row_to_dict(cur.description, row) if row else None

    async def get_attachment_blob(self, attachment_id: int) -> Optional[bytes]:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "SELECT content FROM attachments WHERE id=?",
                (attachment_id,),
            )
            row = await cur.fetchone()
            return row[0] if row else None

    async def delete_attachment(self, attachment_id: int) -> bool:
        async with self.connector.get_connection() as conn:
            await conn.execute("DELETE FROM attachments WHERE id=?", (attachment_id,))
            await conn.commit()
            return True

    async def list_conversations(self) -> list[dict]:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "SELECT id, user_id, title, summary, created_at FROM conversations ORDER BY created_at DESC, id DESC"
            )
            rows = await cur.fetchall()
            return [_row_to_dict(cur.description, r) for r in rows]

    async def rename_conversation(self, conversation_id: int, new_title: str) -> bool:
        async with self.connector.get_connection() as conn:
            await conn.execute(
                "UPDATE conversations SET title=? WHERE id=?",
                (new_title, conversation_id),
            )
            await conn.commit()
            return True

    # ---------- Users ----------
    async def create_user(self, email: str, password_hash: str, display_name: Optional[str]) -> int:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)",
                (email, password_hash, display_name),
            )
            await conn.commit()
            return cur.lastrowid

    async def get_user_by_email(self, email: str) -> Optional[dict]:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "SELECT id, email, password_hash, display_name, created_at FROM users WHERE email=?",
                (email,),
            )
            row = await cur.fetchone()
            return _row_to_dict(cur.description, row) if row else None

    async def get_user(self, user_id: int) -> Optional[dict]:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "SELECT id, email, display_name, created_at FROM users WHERE id=?",
                (user_id,),
            )
            row = await cur.fetchone()
            return _row_to_dict(cur.description, row) if row else None

    async def list_conversations_for_user(self, user_id: int) -> list[dict]:
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                "SELECT id, title, summary, created_at FROM conversations WHERE user_id=? ORDER BY created_at DESC, id DESC",
                (user_id,)
            )
            rows = await cur.fetchall()
            return [_row_to_dict(cur.description, r) for r in rows]

    # ---------- Usage Details ----------
    async def create_usage_detail(self, data: dict) -> int:
        """Create a new usage detail record"""
        keys = "message_id, scope, model, input_tokens, output_tokens, cached_tokens, price"
        placeholders = ",".join("?" for _ in keys.split(", "))
        values = tuple(
            data.get(k.strip())
            for k in [
                "message_id",
                "scope",
                "model", 
                "input_tokens",
                "output_tokens",
                "cached_tokens",
                "price",
            ]
        )
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                f"INSERT INTO usage_details ({keys}) VALUES ({placeholders})",
                values,
            )
            await conn.commit()
            return cur.lastrowid

    async def get_usage_details_for_message(self, message_id: int) -> list[dict]:
        """Get all usage details for a specific message"""
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                """
                SELECT id, message_id, scope, model, input_tokens, output_tokens, 
                       cached_tokens, price, created_at 
                FROM usage_details 
                WHERE message_id=? 
                ORDER BY created_at ASC, id ASC
                """,
                (message_id,),
            )
            rows = await cur.fetchall()
            return [_row_to_dict(cur.description, r) for r in rows]

    async def get_usage_details_for_conversation(self, conversation_id: int) -> list[dict]:
        """Get all usage details for all messages in a conversation"""
        async with self.connector.get_connection() as conn:
            cur = await conn.execute(
                """
                SELECT ud.id, ud.message_id, ud.scope, ud.model, ud.input_tokens, 
                       ud.output_tokens, ud.cached_tokens, ud.price, ud.created_at
                FROM usage_details ud
                JOIN messages m ON ud.message_id = m.id
                WHERE m.conversation_id = ?
                ORDER BY m.created_at ASC, ud.created_at ASC
                """,
                (conversation_id,),
            )
            rows = await cur.fetchall()
            return [_row_to_dict(cur.description, r) for r in rows]
