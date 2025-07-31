"""
Service for pricing calculations based on model token usage rates.
This module defines pricing rates per model and a helper to calculate cost.
"""
from typing import Dict

# Pricing rates are in USD per 1 million tokens
MODEL_PRICING: Dict[str, Dict[str, float]] = {
    # GPT-4.1 pricing (example rates)
    "gpt-4.1": {
        "input": 2.00,         # $2.00 per 1M input tokens
        "cached_input": 0.50,  # $0.50 per 1M cached input tokens
        "output": 8.00         # $8.00 per 1M output tokens
    },
    # Additional model rates can be added here
    # "gpt-3.5-turbo": {"input": 0.0015, "cached_input": 0.0005, "output": 0.0020},
}


def calculate_price(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cached_input_tokens: int = 0
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
        input_tokens * rates.get("input", 0) +
        cached_input_tokens * rates.get("cached_input", 0) +
        output_tokens * rates.get("output", 0)
    ) / 1_000_000
    return cost
