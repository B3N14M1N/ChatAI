# app/services/rag.py
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
            api_key=_load_openai_key(),     # ← explicitly set the key
            model_name=EMBED_MODEL,
        )

        self.client = chromadb.PersistentClient(
            path=str(persist_dir),
            settings=Settings(allow_reset=False),
        )
        self.collection = self.client.get_or_create_collection(
            name="books",
            metadata={"hnsw:space": "cosine"},
            embedding_function=ef,          # ← use Chroma’s built-in EF
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
            text = (
                f"{item.get('title','')}\n"
                f"Genres: {', '.join(item.get('genres', []))}\n"
                f"Themes: {', '.join(item.get('themes', []))}\n"
                f"{item.get('short_summary','')}\n{item.get('full_summary','')}"
            )
            docs.append(text)
            metas.append({
                "title": item.get("title"),
                "genres": ", ".join(item.get("genres", [])),
                "themes": ", ".join(item.get("themes", [])),
                "short_summary": item.get("short_summary"),
                "full_summary": item.get("full_summary"),
            })
        self.collection.add(ids=ids, documents=docs, metadatas=metas)

    # --- Queries ---
    def recommend(self, *, genres: Optional[List[str]]=None, themes: Optional[List[str]]=None, limit: int = 5, random: bool=False) -> List[Dict[str,Any]]:
        if random:
            n = min(limit, self.collection.count())
            if n == 0:
                return []
            res = self.collection.query(query_texts=["*"], n_results=limit)
            return self._pack_results(res)
        parts = []
        if genres: parts.append("Genres: " + ", ".join(genres))
        if themes: parts.append("Themes: " + ", ".join(themes))
        q = " | ".join(parts) or "books"
        res = self.collection.query(query_texts=[q], n_results=limit)
        return self._pack_results(res)

    def get_summaries(self, titles: List[str]) -> List[Dict[str, Any]]:
        if not titles:
            return []
        out: List[Dict[str, Any]] = []
        for t in titles:
            res = self.collection.query(query_texts=[t], n_results=3)
            packed = self._pack_results(res)
            match = next((p for p in packed if p["title"].lower() == t.lower()), (packed[0] if packed else None))
            if match:
                out.append({
                    "title": match["title"],
                    "short_summary": match.get("short_summary"),
                    "full_summary": match.get("full_summary"),
                    "genres": match.get("genres", []),
                    "themes": match.get("themes", []),
                })
        return out

    def _pack_results(self, res) -> List[Dict[str, Any]]:
        if not res or not res.get("metadatas"):
            return []
        out = []
        for md in res["metadatas"][0]:
            # Convert comma-separated strings back to lists
            genres_str = md.get("genres", "")
            themes_str = md.get("themes", "")
            out.append({
                "title": md.get("title"),
                "genres": [g.strip() for g in genres_str.split(",")] if genres_str else [],
                "themes": [t.strip() for t in themes_str.split(",")] if themes_str else [],
                "short_summary": md.get("short_summary"),
                "full_summary": md.get("full_summary"),
            })
        return out
