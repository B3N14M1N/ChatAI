from __future__ import annotations
from pathlib import Path
import json


def get_available_models_from_pricing(pricing_path: Path) -> dict:
    """
    Returns {"chat": [...]} using keys from pricing_data.json.
    Adjust as needed if you have embeddings/tools too.
    """
    data = json.loads(Path(pricing_path).read_text(encoding="utf-8"))
    return {"chat": list(data.keys())}
