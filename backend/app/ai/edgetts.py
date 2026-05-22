import asyncio
import tempfile
import os
from .base import TTSProvider, TTSResult


class EdgeTTSProvider(TTSProvider):
    async def synthesize(self, text: str, *, voice: str = "zh-CN-XiaoxiaoNeural", speed: float = 1.0) -> TTSResult:
        import edge_tts
        rate = f"{int((speed - 1) * 100):+d}%"
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            tmp_path = f.name
        try:
            await communicate.save(tmp_path)
            with open(tmp_path, "rb") as f:
                audio_bytes = f.read()
            return TTSResult(audio_bytes=audio_bytes, format="mp3", duration_ms=0)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
