from pathlib import Path
import aiosqlite

DB_PATH = Path("data/app.db")


class DatabaseConnector:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path

    def get_connection(self):
        """Returns a new database connection context manager."""
        return aiosqlite.connect(str(self.db_path))
