from __future__ import annotations
from typing import Literal
from pydantic import BaseModel

ContextNeed = Literal["none", "last_message", "full"]


class IntentEnvelope(BaseModel):
    context_need: ContextNeed = "none"
