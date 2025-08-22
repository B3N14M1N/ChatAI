from pathlib import Path
import aiosqlite
import os

DB_PATH = Path(os.getenv("DB_PATH", "data/app.db"))


class DatabaseConnector:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path

    def get_connection(self):
        """Returns a new database connection context manager."""
        return aiosqlite.connect(str(self.db_path))
