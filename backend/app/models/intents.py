from __future__ import annotations
from typing import List, Literal, Optional
from pydantic import BaseModel

ContextNeed = Literal["none", "light", "full"]

class BookFilter(BaseModel):
    # all optional: the intent probe may return none for casual chit-chat
    genres: Optional[List[str]] = None
    themes: Optional[List[str]] = None
    random: Optional[bool] = None
    limit: Optional[int] = 5

class IntentEnvelope(BaseModel):
    intent: Literal["smalltalk", "book_recommendations", "book_summary", "other"]
    context_need: ContextNeed = "light"
    # for summary intent
    titles: Optional[List[str]] = None
    # for recommendations
    filter: Optional[BookFilter] = None
