import io
import os
import shutil
import tempfile
import subprocess
import threading
import logging

import zhconv

logger = logging.getLogger(__name__)

if not os.environ.get("HF_ENDPOINT"):
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

_model = None
_model_size = None
_model_lock = threading.Lock()

# Resolve ffmpeg once — WinGet installs may not be on the Windows PATH
_FFMPEG = shutil.which("ffmpeg")
if not _FFMPEG:
    for candidate in [
        r"C:\Users\Administrator\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe",
        r"C:\ffmpeg\bin\ffmpeg.exe",
    ]:
        if os.path.isfile(candidate):
            _FFMPEG = candidate
            break
if _FFMPEG:
    logger.info(f"STT: ffmpeg at {_FFMPEG}")
else:
    logger.warning("STT: ffmpeg not found — non-WAV uploads will fail")


def _get_model(model_size: str = "base"):
    global _model, _model_size
    if _model is not None and _model_size == model_size:
        return _model
    with _model_lock:
        if _model is not None and _model_size == model_size:
            return _model
        from faster_whisper import WhisperModel
        _model = WhisperModel(model_size, device="cpu", compute_type="int8")
        _model_size = model_size
        return _model


class STTService:

    def transcribe(self, audio_bytes: bytes, model_size: str = "base", suffix: str = ".wav") -> dict:
        if len(audio_bytes) < 100:
            logger.warning(f"STT: audio too small ({len(audio_bytes)} bytes)")
            return {"text": "", "language": "unknown"}

        model = _get_model(model_size)
        wav_path = None

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            input_path = tmp.name

        try:
            if suffix == ".wav":
                wav_path = input_path
            elif not _FFMPEG:
                logger.error(f"STT: no ffmpeg available for {suffix}")
                return {"text": "", "language": "unknown"}
            else:
                wav_path = input_path + "_conv.wav"
                subprocess.run([
                    _FFMPEG, "-y", "-i", input_path,
                    "-af", "highpass=f=60, volume=15dB",
                    "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                    "-loglevel", "error", wav_path
                ], check=True, timeout=30)

            segments, info = model.transcribe(
                wav_path, beam_size=5, language="zh",
                condition_on_previous_text=False,
                no_speech_threshold=0.6,
            )
            text = "".join(s.text for s in segments)
            text = zhconv.convert(text, "zh-cn")
            return {"text": text, "language": info.language}
        except subprocess.CalledProcessError as e:
            logger.error(f"STT ffmpeg failed: {e}")
            return {"text": "", "language": "unknown"}
        except Exception as e:
            logger.error(f"STT transcription failed: {type(e).__name__}: {e}")
            return {"text": "", "language": "unknown"}
        finally:
            if suffix != ".wav" and wav_path and wav_path != input_path:
                try:
                    os.unlink(wav_path)
                except OSError:
                    pass
            try:
                os.unlink(input_path)
            except OSError:
                pass
