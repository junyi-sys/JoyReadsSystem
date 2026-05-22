import threading
from .ai.base import LLMProvider, TTSProvider, ImageProvider


class Container:
    """Thread-safe lazy singleton DI container."""

    _lock = threading.Lock()
    _llm: LLMProvider | None = None
    _tts: TTSProvider | None = None
    _image: ImageProvider | None = None

    @classmethod
    def llm(cls) -> LLMProvider:
        if cls._llm is None:
            with cls._lock:
                if cls._llm is None:
                    from .ai.factory import create_llm_provider
                    from .config import settings
                    cls._llm = create_llm_provider(settings)
        return cls._llm

    @classmethod
    def tts(cls) -> TTSProvider:
        if cls._tts is None:
            with cls._lock:
                if cls._tts is None:
                    from .ai.factory import create_tts_provider
                    from .config import settings
                    cls._tts = create_tts_provider(settings)
        return cls._tts

    @classmethod
    def image(cls) -> ImageProvider:
        if cls._image is None:
            with cls._lock:
                if cls._image is None:
                    from .ai.factory import create_image_provider
                    from .config import settings
                    cls._image = create_image_provider(settings)
        return cls._image

    @classmethod
    def reset(cls):
        """Reset all singletons (for testing)."""
        cls._llm = None
        cls._tts = None
        cls._image = None
