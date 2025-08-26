from .connector import DatabaseConnector


class DatabaseInitializer:
    async def init(self, connector: DatabaseConnector):
        async with connector.get_connection() as conn:
            await conn.execute("PRAGMA foreign_keys = ON;")
            await conn.executescript(
                """
                -- Users table
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    display_name TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                -- Conversations table (now scoped to a user)
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    title TEXT,
                    summary TEXT,
                    deleted INTEGER NOT NULL DEFAULT 0, -- soft delete flag
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                -- Messages table with usage metrics
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id INTEGER NOT NULL,
                    request_id INTEGER,
                    text TEXT,
                    summary TEXT,
                    deleted INTEGER NOT NULL DEFAULT 0, -- soft delete flag
                    ignored INTEGER NOT NULL DEFAULT 0, -- system-ignored (e.g., profanity)
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

                -- Usage details table for tracking individual model usages
                CREATE TABLE IF NOT EXISTS usage_details (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id INTEGER NOT NULL,
                    scope TEXT NOT NULL, -- 'title', 'intent', 'summary', 'tool', 'final'
                    model TEXT NOT NULL,
                    input_tokens INTEGER NOT NULL DEFAULT 0,
                    output_tokens INTEGER NOT NULL DEFAULT 0,
                    cached_tokens INTEGER NOT NULL DEFAULT 0,
                    price REAL NOT NULL DEFAULT 0.0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
                );

                -- Works (books) management
                CREATE TABLE IF NOT EXISTS works (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    author TEXT,
                    year TEXT,
                    short_summary TEXT,
                    full_summary TEXT,
                    image_url TEXT,
                    rag_id TEXT, -- id used in Chroma collection
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL CHECK (type IN ('genre', 'theme')),
                    UNIQUE(name, type)
                );

                CREATE TABLE IF NOT EXISTS work_tags (
                    work_id INTEGER NOT NULL,
                    tag_id INTEGER NOT NULL,
                    PRIMARY KEY (work_id, tag_id),
                    FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE,
                    FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
                );

                -- Work cover images stored as blobs
                CREATE TABLE IF NOT EXISTS work_images (
                    work_id INTEGER PRIMARY KEY,
                    content BLOB NOT NULL,
                    content_type TEXT NOT NULL DEFAULT 'image/png',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE
                );

                -- Image versions history (soft-delete + current selection)
                CREATE TABLE IF NOT EXISTS work_image_versions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    work_id INTEGER NOT NULL,
                    content BLOB NOT NULL,
                    content_type TEXT NOT NULL DEFAULT 'image/png',
                    deleted INTEGER NOT NULL DEFAULT 0,
                    is_current INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE
                );
                """
            )
            await conn.commit()

        # Best-effort migrate existing single cover rows into versions as current
        async with connector.get_connection() as conn:
            await conn.execute("PRAGMA foreign_keys = ON;")
            # Insert a version for any work that has a legacy image and no versions yet
            await conn.executescript(
                """
                INSERT INTO work_image_versions (work_id, content, content_type, deleted, is_current, created_at)
                SELECT wi.work_id, wi.content, wi.content_type, 0, 1, wi.created_at
                FROM work_images wi
                WHERE NOT EXISTS (
                    SELECT 1 FROM work_image_versions viv WHERE viv.work_id = wi.work_id
                );
                """
            )
            await conn.commit()
