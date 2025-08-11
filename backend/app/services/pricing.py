"""
Service for pricing calculations based on model token usage rates.
This module defines pricing rates per model and a helper to calculate cost.
"""

import json
from pathlib import Path
from typing import Any, Dict

# Load pricing data from external JSON to separate raw data from logic
_DATA_FILE = Path(__file__).parent.parent / "data" / "pricing_data.json"
try:
    with open(_DATA_FILE, "r", encoding="utf-8") as f:
        MODEL_PRICING: Dict[str, Dict[str, Any]] = json.load(f)
except FileNotFoundError:
    MODEL_PRICING: Dict[str, Dict[str, Any]] = {}


def calculate_price(
    model: str, input_tokens: int, output_tokens: int, cached_input_tokens: int = 0
) -> float:
    """
    Calculate the price for a given model and token usage.

    Args:
        model: model identifier (must exist in MODEL_PRICING)
        input_tokens: number of non-cached input tokens used
        output_tokens: number of output tokens generated
        cached_input_tokens: number of cached input tokens used

    Returns:
        price in USD
    """
    rates = MODEL_PRICING.get(model)
    if rates is None:
        # Fallback: assume zero cost if model not found
        return 0.0

    # Calculate cost proportional to thousand tokens
    # rates are per 1,000,000 tokens
    cost = (
        input_tokens * rates.get("input", 0)
        + cached_input_tokens * rates.get("cached_input", 0)
        + output_tokens * rates.get("output", 0)
    ) / 1_000_000
    return cost


def get_available_models() -> Dict[str, Dict[str, Any]]:
    """
    Return a mapping of model names to their pricing and version metadata.
    """
    return {name: data.copy() for name, data in MODEL_PRICING.items()}
