from chromadb import PersistentClient
from chromadb.config import Settings
from openai import OpenAI
import json, os
from typing import List, Dict
from pathlib import Path

EMBED_MODEL = "text-embedding-3-small"
CHROMA_PATH = "./app/rag/chroma"
BOOKS_PATH = "./app/data/books.json"

client = OpenAI()
chroma_client = PersistentClient(path=CHROMA_PATH, settings=Settings(allow_reset=True))
collection = chroma_client.get_or_create_collection(name="books")

def load_books() -> List[Dict]:
    with open(BOOKS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def embed(texts: List[str]) -> List[List[float]]:
    response = client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [embedding.embedding for embedding in response.data]

def initialize_vector_store(force_reload=False):
    if not force_reload and len(collection.get()["ids"]) > 0:
        return
    books = load_books()
    docs = [f"{b['title']} - {b['genres']} - {b['themes']} - {b['full_summary']}" for b in books]
    ids = [b["title"] for b in books]
    # Convert list fields to strings for ChromaDB compatibility
    metadatas = []
    for book in books:
        metadata = book.copy()
        if isinstance(metadata.get('genres'), list):
            metadata['genres'] = ', '.join(metadata['genres'])
        if isinstance(metadata.get('themes'), list):
            metadata['themes'] = ', '.join(metadata['themes'])
        metadatas.append(metadata)
    embeddings = embed(docs)
    collection.add(documents=docs, embeddings=embeddings, metadatas=metadatas, ids=ids)
