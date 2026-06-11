from fastapi import APIRouter, UploadFile, File, HTTPException
from ...config import settings
from .service import STTService

router = APIRouter(prefix="/api/stt", tags=["语音识别"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="音频文件过大，请限制在20MB以内")

    audio_bytes = await file.read()
    svc = STTService()
    return svc.transcribe(audio_bytes, model_size=settings.STT_MODEL)
