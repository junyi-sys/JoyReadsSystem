import os
import time
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException
from ...config import settings
from .service import STTService

router = APIRouter(prefix="/api/stt", tags=["语音识别"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
DEBUG_DUMP_MAX = 10  # keep only latest N debug dumps


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="音频文件过大，请限制在20MB以内")

    audio_bytes = await file.read()
    suffix = ".wav"
    if file.filename and "." in file.filename:
        suffix = "." + file.filename.rsplit(".", 1)[-1].lower()
        if suffix not in (".webm", ".mp4", ".m4a", ".mp3", ".wav", ".ogg", ".opus", ".flac", ".aac"):
            suffix = ".wav"

    # Save latest upload for debugging, keep only last N
    try:
        dump_dir = os.path.join(tempfile.gettempdir(), "stt_debug")
        os.makedirs(dump_dir, exist_ok=True)
        existing = sorted(os.listdir(dump_dir))
        for old in existing[:-(DEBUG_DUMP_MAX - 1)] if len(existing) >= DEBUG_DUMP_MAX else []:
            try:
                os.unlink(os.path.join(dump_dir, old))
            except OSError:
                pass
        ts = int(time.time() * 1000)
        dump_path = os.path.join(dump_dir, f"latest{ts}{suffix}")
        with open(dump_path, "wb") as f:
            f.write(audio_bytes)
    except Exception:
        pass

    svc = STTService()
    return svc.transcribe(audio_bytes, model_size=settings.STT_MODEL, suffix=suffix)
