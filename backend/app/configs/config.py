# Configuration settings
import os

DATABASE_URL = os.getenv("DATABASE_URL", "./app/database.sqlite3")
EMBED_MODEL = "text-embedding-3-small"
CHROMA_PATH = "./app/rag/chroma"
BOOKS_PATH = "./app/data/books.json"
DEBUG = os.getenv("DEBUG", "False") == "True"
