from pathlib import Path
from typing import List, Optional, Dict, Any

import aiosqlite

from app.configs.config import DATABASE_URL
from app.models.schemas import MessageOut


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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                -- Messages table with usage metrics
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id INTEGER NOT NULL,
                    sender TEXT NOT NULL,
                    text TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    audio BLOB,
                    image BLOB,
                    metadata TEXT,
                    prompt_tokens INTEGER,
                    completion_tokens INTEGER,
                    total_tokens INTEGER,
                    model TEXT,
                    price REAL,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
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

    async def get_conversations(self) -> List[Dict[str, Any]]:
        query = "SELECT * FROM conversations ORDER BY created_at DESC"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query)
            rows = await cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            return [dict(zip(columns, row)) for row in rows]

    async def add_message(
        self,
        conversation_id: int,
        sender: str,
        text: str,
        metadata: Optional[str] = None,
        prompt_tokens: Optional[int] = None,
        completion_tokens: Optional[int] = None,
        total_tokens: Optional[int] = None,
        model: Optional[str] = None,
        price: Optional[float] = None,
    ) -> int:
        # Insert message and usage metrics
        query = (
            "INSERT INTO messages (conversation_id, sender, text, metadata, "
            "prompt_tokens, completion_tokens, total_tokens, model, price) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        params = (
            conversation_id,
            sender,
            text,
            metadata,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            model,
            price,
        )
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, params)
            await conn.commit()
            return cursor.lastrowid

    async def get_latest_message(self, conversation_id: int, sender: str) -> MessageOut:
        query = "SELECT * FROM messages WHERE conversation_id = ?  and sender = ? ORDER BY created_at DESC LIMIT 1"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (conversation_id, sender))
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
    ) -> List[Dict[str, Any]]:
        """
        Retrieve attachment metadata for a specific message.
        """
        query = (
            "SELECT id, filename, content_type FROM attachments WHERE message_id = ?"
        )
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (message_id,))
            rows = await cursor.fetchall()
            cols = [desc[0] for desc in cursor.description]
            return [dict(zip(cols, row)) for row in rows]

    async def get_attachment(self, attachment_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve full attachment record including content for download.
        """
        query = "SELECT filename, content, content_type FROM attachments WHERE id = ?"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (attachment_id,))
            row = await cursor.fetchone()
            if not row:
                return None
            cols = [desc[0] for desc in cursor.description]
            return dict(zip(cols, row))


db_connector = DatabaseConnector()


db_handler = DatabaseHandler(db_connector)
