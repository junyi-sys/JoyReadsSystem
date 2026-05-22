import httpx
from openai import OpenAI
from .base import ImageProvider


class CogViewProvider(ImageProvider):
    def __init__(self, api_key: str, model: str = "cogview-3-plus"):
        self._client = OpenAI(
            api_key=api_key,
            base_url="https://open.bigmodel.cn/api/paas/v4/",
            http_client=httpx.Client(timeout=60.0),
        )
        self._model = model

    async def generate(self, prompt: str, *, style: str = "children-illustration", size: tuple = (1024, 1024)) -> str:
        import asyncio
        full_prompt = f"{prompt}, {style}, colorful, warm, cute, 适合儿童的卡通插画风格"
        resp = await asyncio.to_thread(
            lambda: self._client.images.generate(
                model=self._model,
                prompt=full_prompt,
                size=f"{size[0]}x{size[1]}",
                n=1,
            )
        )
        return resp.data[0].url
