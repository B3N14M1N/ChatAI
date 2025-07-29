from pathlib import Path
from typing import List, Optional, Dict, Any

import aiosqlite

from app.core.config import DATABASE_URL
from app.core.schemas import MessageOut


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
                -- Conversations table (standalone)
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                -- Messages table linked to conversations
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id INTEGER NOT NULL,
                    sender TEXT NOT NULL,
                    text TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    -- Future extension fields
                    audio BLOB,
                    image BLOB,
                    metadata TEXT,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
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

    async def add_message(self, conversation_id: int, sender: str, text: str, metadata: Optional[str] = None) -> int:
        query = "INSERT INTO messages (conversation_id, sender, text, metadata) VALUES (?, ?, ?, ?)"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (conversation_id, sender, text, metadata))
            await conn.commit()
            return cursor.lastrowid

    async def get_latest_message(self, conversation_id: int, sender: str) -> MessageOut:
        query = "SELECT * FROM messages WHERE conversation_id = ?  and sender = ? ORDER BY created_at DESC LIMIT 1"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (conversation_id,sender))
            row = await cursor.fetchone()
            if row:
                columns = [column[0] for column in cursor.description]
                return MessageOut(**dict(zip(columns, row)))
            return None

    async def get_conversation_messages(self, conversation_id: int) -> List[MessageOut]:
        query = "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
        async with self.connector.get_connection() as conn:
            cursor = await conn.execute(query, (conversation_id,))
            rows = await cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            return [MessageOut(**dict(zip(columns, row))) for row in rows]


db_connector = DatabaseConnector()


db_handler = DatabaseHandler(db_connector)