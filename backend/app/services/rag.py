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
        genres: Optional[List[str]] = None,
        themes: Optional[List[str]] = None,
        authors: Optional[List[str]] = None,
        content: Optional[str] = None,
        limit: int = 5,
        random: bool = False,
    ) -> List[Dict[str, Any]]:
        if random:
            n = min(limit, self.collection.count())
            if n == 0:
                return []

            # For random search with constraints, get a larger sample to filter from
            if genres or themes or authors or content:
                # Create a query that's more likely to find relevant books
                query_parts = []
                if genres:
                    query_parts.extend(genres)
                if themes:
                    query_parts.extend(themes)
                if authors:
                    query_parts.extend(authors)
                if content:
                    query_parts.append(content)

                if query_parts:
                    # Use a query that matches the constraints for better initial results
                    query = f"books {' '.join(query_parts)}"
                else:
                    query = "interesting books"

                # Get more results to have options after filtering
                search_limit = min(limit * 4, self.collection.count())
            else:
                # No constraints, just get random books
                query = "interesting books"
                search_limit = limit * 2

            res = self.collection.query(query_texts=[query], n_results=search_limit)
            results = self._pack_results(res)

            # Apply genre/theme/author filtering if specified
            if genres or themes or authors:
                results = self._filter_by_metadata(results, genres, themes, authors)

            # Randomly shuffle and take the limit
            import random as rand

            rand.shuffle(results)
            return results[:limit]

        # Build semantic query for embeddings - this is the key improvement
        query_parts = []
        
        # Prioritize content-based search if content is provided
        if content:
            # Use the content directly as the main query for semantic search
            query = content
        else:
            # Build query from other parameters
            if themes:
                query_parts.extend(themes)
            if genres:
                query_parts.extend(genres)
            if authors:
                query_parts.extend(authors)

            # Create a natural language query for better embedding matching
            if query_parts:
                # Use natural language that would appear in book descriptions
                if themes:
                    theme_text = f"books about {', '.join(themes)}"
                    query_parts.append(theme_text)
                if genres:
                    genre_text = f"{', '.join(genres)} genre books"
                    query_parts.append(genre_text)
                if authors:
                    author_text = f"books by {', '.join(authors)}"
                    query_parts.append(author_text)
                query = f"{' '.join(query_parts)} book recommendations"
            else:
                query = "book recommendations"

        # Use embeddings for semantic search - get more results initially
        # This is the key: let embeddings do the heavy lifting
        res = self.collection.query(query_texts=[query], n_results=min(limit * 4, 30))

        results = self._pack_results(res)

        # If content search is used, rely primarily on semantic similarity
        if content:
            # For content-based search, apply minimal filtering and rely on embedding similarity
            if genres or themes or authors:
                # Apply light metadata filtering but be more lenient
                distances = res.get("distances", [[]])[0] if res.get("distances") else []
                filtered_results = self._score_and_filter_results(
                    results, genres, themes, authors, distances
                )
                return filtered_results[:limit]
            else:
                # Pure content search - return based on semantic similarity only
                return results[:limit]
        
        # Traditional metadata-based search
        elif genres or themes or authors:
            distances = res.get("distances", [[]])[0] if res.get("distances") else []
            filtered_results = self._score_and_filter_results(
                results, genres, themes, authors, distances
            )
            return filtered_results[:limit]

        return results[:limit]

    def _filter_by_metadata(
        self,
        results: List[Dict],
        genres: Optional[List[str]],
        themes: Optional[List[str]],
        authors: Optional[List[str]],
    ) -> List[Dict]:
        """Simple metadata filtering for exact matches (used for random selection)."""
        if not genres and not themes and not authors:
            return results

        filtered = []
        for book in results:
            book_genres = [g.lower() for g in book.get("genres", [])]
            book_themes = [t.lower() for t in book.get("themes", [])]
            book_author = (book.get("author") or "").lower()

            # Check for matches - more lenient for random selection
            genre_match = not genres or any(g.lower() in book_genres for g in genres)
            theme_match = not themes or any(t.lower() in book_themes for t in themes)
            # For authors, use OR logic between multiple authors (any author can match)
            author_match = not authors or any(a.lower() in book_author for a in authors)

            # If we have multiple constraint types, use OR logic between them
            # If we have only one constraint type, just check that one
            constraints_present = [genres, themes, authors]
            active_constraints = [c for c in constraints_present if c]
            
            if len(active_constraints) > 1:
                # Multiple constraint types - any one can match
                if genre_match or theme_match or author_match:
                    filtered.append(book)
            else:
                # Only one constraint type - must match that specific constraint
                if genres and genre_match:
                    filtered.append(book)
                elif themes and theme_match:
                    filtered.append(book)
                elif authors and author_match:
                    filtered.append(book)

        return filtered

    def _score_and_filter_results(
        self,
        results: List[Dict],
        genres: Optional[List[str]],
        themes: Optional[List[str]],
        authors: Optional[List[str]],
        distances: List[float],
    ) -> List[Dict]:
        """Score results by both embedding similarity and metadata relevance, but prioritize similarity."""
        scored_results = []

        for i, book in enumerate(results):
            # Start with embedding similarity score (lower distance = higher similarity)
            similarity_score = 0
            if i < len(distances):
                # Convert distance to similarity (0-1 scale, higher is better)
                similarity_score = max(0, 1.0 - min(distances[i], 1.0))

            # Base score from embedding similarity - this is most important
            total_score = similarity_score * 2.0  # Weight embedding similarity heavily

            # Add bonus points for exact metadata matches, but don't require them
            book_genres = [g.lower() for g in book.get("genres", [])]
            book_themes = [t.lower() for t in book.get("themes", [])]
            book_author = (book.get("author") or "").lower()

            metadata_bonus = 0
            if genres:
                genre_matches = sum(1 for g in genres if g.lower() in book_genres)
                metadata_bonus += (
                    genre_matches * 0.3
                )  # Small bonus for exact genre matches

            if themes:
                theme_matches = sum(1 for t in themes if t.lower() in book_themes)
                metadata_bonus += (
                    theme_matches * 0.3
                )  # Small bonus for exact theme matches

            if authors:
                # For authors, prioritize metadata matches over embedding similarity
                author_matches = sum(1 for a in authors if a.lower() in book_author)
                if author_matches > 0:
                    # If we found an author match, include this result regardless of similarity
                    metadata_bonus += author_matches * 0.5
                    total_score += metadata_bonus
                    book["_total_score"] = total_score
                    book["_similarity_score"] = similarity_score
                    book["_metadata_bonus"] = metadata_bonus
                    scored_results.append(book)
                    continue

            total_score += metadata_bonus

            # For non-author searches or when no author match found,
            # rely on embedding similarity with metadata bonus
            min_similarity = 0.3 if authors else 0.7  # Lower threshold when searching by author
            if similarity_score > min_similarity:  
                book["_total_score"] = total_score
                book["_similarity_score"] = similarity_score
                book["_metadata_bonus"] = metadata_bonus
                scored_results.append(book)

        # Sort by total score (embedding similarity + metadata bonus)
        scored_results.sort(key=lambda x: x.get("_total_score", 0), reverse=True)

        # Clean up scoring fields
        for book in scored_results:
            book.pop("_total_score", None)
            book.pop("_similarity_score", None)
            book.pop("_metadata_bonus", None)

        return scored_results

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
