from ...ai.base import TTSProvider


class TTSService:
    def __init__(self, tts_provider: TTSProvider):
        self.tts = tts_provider
        self._cache: dict[str, bytes] = {}

    async def synthesize(self, text: str, speed: float = 1.0) -> bytes:
        cache_key = f"{text}|{speed}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        result = await self.tts.synthesize(text, speed=speed)
        self._cache[cache_key] = result.audio_bytes

        # LRU eviction: keep max 500 entries
        if len(self._cache) > 500:
            oldest = next(iter(self._cache))
            del self._cache[oldest]

        return result.audio_bytes
