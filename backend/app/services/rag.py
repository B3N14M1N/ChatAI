from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from pathlib import Path
import os, json, uuid

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions

EMBED_MODEL = "text-embedding-3-small"


@dataclass
class Book:
    id: str
    title: str
    genres: List[str]
    themes: List[str]
    short_summary: Optional[str]
    full_summary: Optional[str]


def _load_openai_key() -> str:
    key = os.getenv("OPENAI_API_KEY")
    if not key or not key.strip():
        raise RuntimeError("OPENAI_API_KEY not set in environment.")
    return key.strip()


class BookRAG:
    def __init__(self, data_path: Path, persist_dir: Path = Path("data/chroma")):
        self.data_path = Path(data_path)

        ef = embedding_functions.OpenAIEmbeddingFunction(
            api_key=_load_openai_key(),
            model_name=EMBED_MODEL,
        )

        self.client = chromadb.PersistentClient(
            path=str(persist_dir),
            settings=Settings(allow_reset=False),
        )
        self.collection = self.client.get_or_create_collection(
            name="books",
            metadata={"hnsw:space": "cosine"},
            embedding_function=ef,
        )
        self._ensure_ingested()

    def _ensure_ingested(self) -> None:
        if self.collection.count() > 0:
            return
        data = json.loads(self.data_path.read_text(encoding="utf-8"))
        ids, docs, metas = [], [], []
        for item in data:
            bid = str(uuid.uuid4())
            ids.append(bid)
            # Create rich text for embedding following ChromaDB best practices
            title = item.get("title", "")
            author = item.get("author", "")
            year = item.get("year", "")
            genres = item.get("genres", [])
            themes = item.get("themes", [])
            short_summary = item.get("short_summary", "")
            full_summary = item.get("full_summary", "")

            # Rich document text for better embedding matching
            text = f"""Title: {title}
                Author: {author}
                Year: {year}
                Genres: {', '.join(genres)}
                Themes: {', '.join(themes)}
                Summary: {short_summary}
                {full_summary}"""

            docs.append(text)
            metas.append(
                {
                    "title": title,
                    "author": author,
                    "year": str(year) if year else "",
                    "genres": ", ".join(genres),  # Store as comma-separated string
                    "themes": ", ".join(themes),  # Store as comma-separated string
                    "short_summary": short_summary,
                    "full_summary": full_summary,
                }
            )
        self.collection.add(ids=ids, documents=docs, metadatas=metas)

    # --- Queries ---
    def recommend(
        self,
        *,
        content: Optional[str] = None,
        authors: Optional[List[str]] = None,
        limit: int = 5,
        # Legacy parameters for backward compatibility - will be merged into content
        genres: Optional[List[str]] = None,
        themes: Optional[List[str]] = None,
        random: bool = False,  # Ignored for now
        **kwargs  # Catch any other parameters
    ) -> List[Dict[str, Any]]:
        """
        Simplified content-based book recommendation.
        All search is now purely semantic based on content similarity.
        """
        try:
            # Merge all content into a single search query
            search_parts = []
            if content:
                search_parts.append(content)
            if genres:
                search_parts.extend(genres)
            if themes:
                search_parts.extend(themes)
            
            search_query = " ".join(search_parts).strip()
            
            if not search_query:
                search_query = "book recommendations"
            
            # Perform simple semantic search
            results = self._semantic_search(search_query, limit * 2)  # Get extra for filtering
            
            # Simple author filtering if specified
            if authors:
                author_names = [name.lower() for name in authors]
                results = [r for r in results if any(author.lower() in r.get('author', '').lower() for author in author_names)]
            
            # Return top results
            return results[:limit]
            
        except Exception as e:
            print(f"Error in recommend: {e}")
            return []
    
    def _semantic_search(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Pure semantic search without complex filtering"""
        try:
            result = self.collection.query(
                query_texts=[query],
                n_results=min(limit, self.collection.count())
            )
            
            return self._pack_results(result)
            
        except Exception as e:
            print(f"Error in semantic search: {e}")
            return []
    def get_summaries(self, titles: List[str]) -> List[Dict[str, Any]]:
        if not titles:
            return []
        out: List[Dict[str, Any]] = []
        for t in titles:
            res = self.collection.query(query_texts=[t], n_results=3)
            packed = self._pack_results(res)
            match = next(
                (p for p in packed if p["title"].lower() == t.lower()),
                (packed[0] if packed else None),
            )
            if match:
                out.append(
                    {
                        "title": match["title"],
                        "short_summary": match.get("short_summary"),
                        "full_summary": match.get("full_summary"),
                        "genres": match.get("genres", []),
                        "themes": match.get("themes", []),
                    }
                )
        return out

    def _pack_results(self, res) -> List[Dict[str, Any]]:
        if not res or not res.get("metadatas"):
            return []
        out = []
        for md in res["metadatas"][0]:
            # Handle both list and string formats for backward compatibility
            genres = md.get("genres", [])
            themes = md.get("themes", [])

            # If stored as strings (old format), convert to lists
            if isinstance(genres, str):
                genres = [g.strip() for g in genres.split(",")] if genres else []
            if isinstance(themes, str):
                themes = [t.strip() for t in themes.split(",")] if themes else []

            out.append(
                {
                    "title": md.get("title"),
                    "author": md.get("author"),
                    "genres": genres,
                    "themes": themes,
                    "short_summary": md.get("short_summary"),
                    "full_summary": md.get("full_summary"),
                }
            )
        return out
