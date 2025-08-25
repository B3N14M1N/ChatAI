from __future__ import annotations

from better_profanity import profanity


class ProfanityFilter:
    _initialized: bool = False

    @classmethod
    def _ensure_initialized(cls):
        if not cls._initialized:
            try:
                profanity.load_censor_words()
            except Exception:
                # Fallback silently; library ships with defaults
                pass
            cls._initialized = True

    @classmethod
    def contains_profanity(cls, text: str) -> bool:
        cls._ensure_initialized()
        return profanity.contains_profanity(text or "")

    @classmethod
    def censor(cls, text: str) -> str:
        cls._ensure_initialized()
        return profanity.censor(text or "")
