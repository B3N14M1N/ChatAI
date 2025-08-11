# Configuration settings
import os

DATABASE_URL = os.getenv("DATABASE_URL", "./app/database.sqlite3")
DEBUG = os.getenv("DEBUG", "False") == "True"
