import httpx
from openai import OpenAI
from .base import LLMProvider, GenerationResult


class DeepSeekProvider(LLMProvider):
    def __init__(self, api_key: str, base_url: str, model: str):
        self._client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            http_client=httpx.Client(timeout=120.0),
        )
        self._model = model

    async def generate(self, prompt: str, *, system: str = "", temperature: float = 0.7, max_tokens: int = 2000) -> GenerationResult:
        import asyncio
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        resp = await asyncio.to_thread(
            lambda: self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        )
        choice = resp.choices[0]
        return GenerationResult(
            content=choice.message.content.strip(),
            tokens_used=resp.usage.total_tokens if resp.usage else 0,
            model=self._model,
        )
