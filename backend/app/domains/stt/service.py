import io
import os
import tempfile
import logging

logger = logging.getLogger(__name__)

# Use HF mirror for model download in China
if not os.environ.get("HF_ENDPOINT"):
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

_model = None
_model_size = None


def _get_model(model_size: str = "base"):
    """Lazy-load singleton model. Choices: tiny, base, small, medium."""
    global _model, _model_size
    if _model is not None and _model_size == model_size:
        return _model

    from faster_whisper import WhisperModel
    import platform

    device = "cpu"
    compute = "int8"
    if platform.system() == "Darwin" and platform.processor() == "arm":
        compute = "auto"

    logger.info(f"Loading Whisper model: {model_size} on {device}/{compute} ...")
    _model = WhisperModel(model_size, device=device, compute_type=compute)
    _model_size = model_size
    return _model


class STTService:
    def __init__(self):
        from ...config import settings as cfg
        self.model_size = getattr(cfg, "STT_MODEL", None) or "base"

    def transcribe(self, audio_bytes: bytes, filename: str = "recording.webm") -> str:
        model = _get_model(self.model_size)

        # Write audio to temp file so faster-whisper can decode via ffmpeg/av
        suffix = os.path.splitext(filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        try:
            segments, _ = model.transcribe(tmp_path, language="zh", beam_size=5)
            text = " ".join(s.text.strip() for s in segments)
            return text.strip()
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
