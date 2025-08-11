from typing import List
from pydantic import BaseModel
from app.rag.vector_store import collection, embed

class BookRecommendationInput(BaseModel):
    genre: str
    top_k: int = 5

class BookSummaryInput(BaseModel):
    title: str

class BookRecommendationOutput(BaseModel):
    title: str
    author: str
    short_summary: str

def recommend_books(genre: str, top_k: int = 5) -> List[BookRecommendationOutput]:
    # Use semantic search to find books related to the genre with OpenAI embeddings
    query_text = f"genre {genre} books"
    query_embedding = embed([query_text])[0]
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )
    return [
        BookRecommendationOutput(
            title=md["title"],
            author=md["author"],
            short_summary=md["short_summary"],
        )
        for md in results["metadatas"][0]
    ]

def get_book_summary(title: str) -> str:
    # Use OpenAI embeddings for consistency
    query_embedding = embed([title])[0]
    result = collection.query(query_embeddings=[query_embedding], n_results=1)
    return result["metadatas"][0][0]["full_summary"]
