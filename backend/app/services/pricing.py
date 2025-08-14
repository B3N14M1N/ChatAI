from __future__ import annotations
import json
from pathlib import Path


class PricingService:
    def __init__(self, pricing_path: Path):
        self._data = json.loads(Path(pricing_path).read_text(encoding="utf-8"))

    def price_chat_usage(
        self,
        *,
        model: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cached_tokens: int = 0,
    ) -> float:
        """
        Computes price using your pricing_data.json structure:
        {
          "gpt-4o-mini": {"input": 0.15, "output": 0.6, "cached_input": 0.075},
          ...
        }
        """
        m = self._data.get(model)
        if not m:
            return 0.0

        def _cost(tokens: int, per_million: float) -> float:
            return (tokens / 1_000_000) * per_million

        price = 0.0
        price += _cost(input_tokens, float(m.get("input", 0)))
        price += _cost(output_tokens, float(m.get("output", 0)))
        price += _cost(cached_tokens, float(m.get("cached_input", 0)))
        return round(price, 7)
