from pathlib import Path
from typing import List, Optional, Dict, Any

import aiosqlite

from app.configs.config import DATABASE_URL
from app.models.schemas import MessageOut, ConversationOut, AttachmentOut, MessageSummary


DB_PATH = Path(DATABASE_URL)


class DatabaseConnector:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    def get_connection(self):
        """Returns a new database connection context manager."""
        return aiosqlite.connect(str(self.db_path))

    async def init_db(self):
        async with self.get_connection() as conn:
            await conn.execute("PRAGMA foreign_keys = ON;")
            await conn.executescript(
                """
                -- Conversations table
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    summary TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                -- Messages table with usage metrics
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id INTEGER NOT NULL,
                    request_id INTEGER,
                    text TEXT,
                    summary TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    input_tokens INTEGER,
                    output_tokens INTEGER,
                    cached_tokens INTEGER,
                    model TEXT,
                    price REAL,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                    FOREIGN KEY(request_id) REFERENCES messages(id) ON DELETE CASCADE
                );
                -- Attachments table for message files
                CREATE TABLE IF NOT EXISTS attachments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    content BLOB,
                    content_type TEXT,
                    FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
                );
                """
            )
            
            # Migration: Add summary column if it doesn't exist
            try:
                await conn.execute("ALTER TABLE messages ADD COLUMN summary TEXT;")
                print("Added summary column to messages table")
            except Exception:
                # Column already exists, which is fine
                pass
                
            await conn.commit()


class DatabaseHandler:
    def __init__(self, connector: DatabaseConnector):
        self.connector = connector

    async def create_conversation(self, title: Optional[str] = None) -> int:
        query = "INSERT INTO conversations (title) VALUES (?)"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (title,))
            await conn.commit()
            return cursor.lastrowid

    async def rename_conversation(self, conversation_id: int, new_title: str) -> None:
        query = "UPDATE conversations SET title = ? WHERE id = ?"
        async with self.connector.get_connection() as conn:
            await conn.execute(query, (new_title, conversation_id))
            await conn.commit()

    async def delete_conversation(self, conversation_id: int) -> None:
        query = "DELETE FROM conversations WHERE id = ?"
        async with self.connector.get_connection() as conn:
            await conn.execute(query, (conversation_id,))
            await conn.commit()

    async def get_conversations(self) -> List[ConversationOut]:
        query = "SELECT * FROM conversations ORDER BY created_at DESC"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query)
            rows = await cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            return [ConversationOut(**dict(zip(columns, row))) for row in rows]

    async def add_message(
        self,
        conversation_id: int,
        text: str,
        summary: Optional[str] = None,
        request_id: Optional[int] = None,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        cached_tokens: Optional[int] = None,
        model: Optional[str] = None,
        price: Optional[float] = None,
    ) -> int:
        # Insert message and usage metrics
        query = (
            "INSERT INTO messages (conversation_id, text, summary, request_id, "
            "input_tokens, output_tokens, cached_tokens, model, price) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        params = (
            conversation_id,
            text,
            summary,
            request_id,
            input_tokens,
            output_tokens,
            cached_tokens,
            model,
            price,
        )
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, params)
            await conn.commit()
            return cursor.lastrowid

    async def get_latest_message(self, conversation_id: int, is_user: bool = True) -> MessageOut:
        # If is_user=True, get message with no request_id (user message)
        # If is_user=False, get message with request_id (assistant response)
        if is_user:
            query = "SELECT * FROM messages WHERE conversation_id = ? AND request_id IS NULL ORDER BY created_at DESC LIMIT 1"
        else:
            query = "SELECT * FROM messages WHERE conversation_id = ? AND request_id IS NOT NULL ORDER BY created_at DESC LIMIT 1"
        
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (conversation_id,))
            row = await cursor.fetchone()
            if row:
                columns = [column[0] for column in cursor.description]
                return MessageOut(**dict(zip(columns, row)))
            return None

    async def get_conversation_messages(self, conversation_id: int) -> List[MessageOut]:
        query = (
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
        )
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (conversation_id,))
            rows = await cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            return [MessageOut(**dict(zip(columns, row))) for row in rows]

    async def get_conversation_summary(self, conversation_id: int) -> List[MessageSummary]:
        """
        Get a summary view of conversation messages with display text and sender information.
        """
        messages = await self.get_conversation_messages(conversation_id)
        return [
            MessageSummary(
                id=message.id,
                sender=message.sender,
                text=message.display_text,
                created_at=message.created_at,
                request_id=message.request_id
            )
            for message in messages
        ]

    async def add_user_message(
        self,
        conversation_id: int,
        text: str,
        summary: Optional[str] = None,
    ) -> int:
        """
        Add a user message (no request_id).
        """
        return await self.add_message(
            conversation_id=conversation_id,
            text=text,
            summary=summary,
            request_id=None
        )

    async def add_assistant_response(
        self,
        conversation_id: int,
        text: str,
        request_id: int,
        summary: Optional[str] = None,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        cached_tokens: Optional[int] = None,
        model: Optional[str] = None,
        price: Optional[float] = None,
    ) -> int:
        """
        Add an assistant response message (with request_id pointing to the user message).
        """
        return await self.add_message(
            conversation_id=conversation_id,
            text=text,
            summary=summary,
            request_id=request_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cached_tokens=cached_tokens,
            model=model,
            price=price
        )

    async def get_user_messages(self, conversation_id: int) -> List[MessageOut]:
        """
        Get all user messages in a conversation (messages with no request_id).
        """
        query = "SELECT * FROM messages WHERE conversation_id = ? AND request_id IS NULL ORDER BY created_at ASC"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (conversation_id,))
            rows = await cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            return [MessageOut(**dict(zip(columns, row))) for row in rows]

    async def get_assistant_responses(self, conversation_id: int) -> List[MessageOut]:
        """
        Get all assistant responses in a conversation (messages with request_id).
        """
        query = "SELECT * FROM messages WHERE conversation_id = ? AND request_id IS NOT NULL ORDER BY created_at ASC"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (conversation_id,))
            rows = await cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            return [MessageOut(**dict(zip(columns, row))) for row in rows]

    async def get_message_by_id(self, message_id: int) -> Optional[MessageOut]:
        """
        Get a specific message by its ID.
        """
        query = "SELECT * FROM messages WHERE id = ?"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (message_id,))
            row = await cursor.fetchone()
            if row:
                columns = [column[0] for column in cursor.description]
                return MessageOut(**dict(zip(columns, row)))
            return None

    async def add_attachment(
        self, message_id: int, filename: str, content: bytes, content_type: str
    ) -> int:
        """
        Insert an attachment linked to a message.
        """
        query = (
            "INSERT INTO attachments (message_id, filename, content, content_type) "
            "VALUES (?, ?, ?, ?)"
        )
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(
                query, (message_id, filename, content, content_type)
            )
            await conn.commit()
            return cursor.lastrowid

    async def get_attachments_for_message(
        self, message_id: int
    ) -> List[AttachmentOut]:
        """
        Retrieve attachment metadata for a specific message.
        """
        query = (
            "SELECT id, message_id, filename, content_type FROM attachments WHERE message_id = ?"
        )
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (message_id,))
            rows = await cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            return [AttachmentOut(**dict(zip(columns, row))) for row in rows]

    async def get_attachment(self, attachment_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve full attachment record including content for download.
        """
        query = "SELECT id, message_id, filename, content, content_type FROM attachments WHERE id = ?"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (attachment_id,))
            row = await cursor.fetchone()
            if not row:
                return None
            cols = [desc[0] for desc in cursor.description]
            return dict(zip(cols, row))


db_connector = DatabaseConnector()


db_handler = DatabaseHandler(db_connector)
