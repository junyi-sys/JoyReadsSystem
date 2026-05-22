from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class GenerationResult:
    content: str
    tokens_used: int = 0
    model: str = ""


@dataclass
class TTSResult:
    audio_bytes: bytes
    format: str = "mp3"
    duration_ms: int = 0


class LLMProvider(ABC):
    """大语言模型统一接口"""

    @abstractmethod
    async def generate(self, prompt: str, *, system: str = "", temperature: float = 0.7, max_tokens: int = 2000) -> GenerationResult:
        ...

    async def generate_json(self, prompt: str, *, system: str = "", temperature: float = 0.3) -> dict:
        """Generate JSON with automatic cleaning and retry."""
        import json, logging
        logger = logging.getLogger(__name__)
        for attempt in range(3):
            result = await self.generate(
                prompt + "\n\n只返回JSON，不要有其他内容，不要用markdown代码块包裹。",
                system=system, temperature=temperature,
            )
            raw = result.content.strip()
            raw = raw.replace("```json", "").replace("```", "").strip()
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                logger.warning(f"JSON parse attempt {attempt+1} failed: {raw[:200]}")
        raise ValueError("Failed to generate valid JSON after 3 attempts")


class ImageProvider(ABC):
    """图片生成统一接口"""

    @abstractmethod
    async def generate(self, prompt: str, *, style: str = "children-illustration", size: tuple = (1024, 1024)) -> str:
        """Return image URL."""
        ...


class TTSProvider(ABC):
    """语音合成统一接口"""

    @abstractmethod
    async def synthesize(self, text: str, *, voice: str = "zh-CN-child", speed: float = 1.0) -> TTSResult:
        ...
