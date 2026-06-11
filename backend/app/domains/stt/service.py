import io
import os
import tempfile
import logging

logger = logging.getLogger(__name__)

if not os.environ.get("HF_ENDPOINT"):
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

_model = None
_model_size = None


def _get_model(model_size: str = "base"):
    global _model, _model_size
    if _model is not None and _model_size == model_size:
        return _model
    from faster_whisper import WhisperModel
    _model = WhisperModel(model_size, device="cpu", compute_type="int8")
    _model_size = model_size
    return _model


class STTService:

    def transcribe(self, audio_bytes: bytes, model_size: str = "base") -> dict:
        model = _get_model(model_size)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        try:
            segments, info = model.transcribe(tmp_path, beam_size=5)
            text = "".join(s.text for s in segments)
            return {"text": text, "language": info.language}
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
