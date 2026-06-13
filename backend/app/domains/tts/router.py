from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from fastapi.responses import Response

from ...di import Container
from .service import TTSService

router = APIRouter(prefix="/api/tts", tags=["语音"])


class SynthesizeRequest(BaseModel):
    text: str
    speed: float = 1.0


@router.post("/synthesize")
async def synthesize(body: SynthesizeRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="文本不能为空")
    try:
        svc = TTSService(Container.tts())
        audio = await svc.synthesize(body.text, body.speed)
        return Response(content=audio, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"语音合成失败: {str(e)}")
