import asyncio
import time
from typing import Any, Optional


class TTLCache:
    def __init__(self, default_ttl_seconds: int = 60):
        # Default time-to-live for cache entries (in seconds)
        self._default_ttl = default_ttl_seconds
        # Asyncio lock to ensure thread-safe access to the cache
        self._lock = asyncio.Lock()
        # Internal store: maps keys to (expiration timestamp, value)
        self._store: dict[str, tuple[float, Any]] = {}

    def _now(self) -> float:
        # Returns the current monotonic time (not affected by system clock changes)
        return time.monotonic()

    async def get(self, key: str) -> Optional[Any]:
        # Retrieves a value from the cache if it hasn't expired
        async with self._lock:
            item = self._store.get(key)
            if not item:
                # Key not found
                return None
            expires_at, value = item
            if self._now() > expires_at:
                # Entry expired; remove it and return None
                self._store.pop(key, None)
                return None
            # Entry valid; return the value
            return value

    async def set(
        self, key: str, value: Any, ttl_seconds: Optional[int] = None
    ) -> None:
        # Stores a value in the cache with an optional TTL
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        async with self._lock:
            # Save the value with its expiration time
            self._store[key] = (self._now() + ttl, value)

    async def delete(self, key: str) -> None:
        # Removes a specific key from the cache
        async with self._lock:
            self._store.pop(key, None)

    async def clear(self) -> None:
        # Clears all entries from the cache
        async with self._lock:
            self._store.clear()
