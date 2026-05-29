from fastapi import APIRouter, UploadFile, File, HTTPException

from .service import STTService

router = APIRouter(prefix="/api/stt", tags=["语音识别"])


MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    try:
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="音频文件过大，请限制在20MB以内")

        audio_bytes = await file.read()
        if len(audio_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="音频文件过大，请限制在20MB以内")
        if not audio_bytes or len(audio_bytes) < 100:
            raise HTTPException(status_code=400, detail="音频数据过短")

        svc = STTService()
        text = svc.transcribe(audio_bytes, filename=file.filename or "recording.webm")
        return {"text": text.strip()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"语音识别失败: {str(e)}")
