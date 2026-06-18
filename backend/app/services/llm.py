from abc import ABC, abstractmethod
import httpx
from app.core.config import get_settings


class ModelUnavailableError(RuntimeError):
    pass


class LLMProvider(ABC):
    @abstractmethod
    async def chat(self, system: str, user: str) -> str:
        raise NotImplementedError

    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        raise NotImplementedError


class OllamaProvider(LLMProvider):
    def __init__(self) -> None:
        self.settings = get_settings()

    async def chat(self, system: str, user: str) -> str:
        payload = {
            "model": self.settings.ollama_chat_model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "stream": False,
            "keep_alive": self.settings.ollama_keep_alive,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                response = await client.post(f"{self.settings.ollama_base_url}/api/chat", json=payload)
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise ModelUnavailableError(
                    "Ollama is unavailable. Start Ollama with `ollama serve` and pull the local models: "
                    "`ollama pull llama3.2:3b` and `ollama pull bge-m3`."
                ) from exc
            return response.json()["message"]["content"]

    async def embed(self, text: str) -> list[float]:
        model = getattr(self.settings, "ollama_embedding_model", self.settings.ollama_embed_model)
        keep_alive = self.settings.ollama_keep_alive
        embed_payload = {"model": model, "input": text, "keep_alive": keep_alive}
        legacy_payload = {"model": model, "prompt": text, "keep_alive": keep_alive}
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                response = await client.post(f"{self.settings.ollama_base_url}/api/embed", json=embed_payload)
                if response.status_code == 404:
                    response = await client.post(f"{self.settings.ollama_base_url}/api/embeddings", json=legacy_payload)
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise ModelUnavailableError(
                    "Ollama embeddings are unavailable. Start Ollama with `ollama serve` and pull `bge-m3`."
                ) from exc
            data = response.json()
            if "embeddings" in data:
                embeddings = data.get("embeddings") or []
                return embeddings[0] if embeddings else []
            return data.get("embedding", [])


class DeterministicFallbackProvider(LLMProvider):
    async def chat(self, system: str, user: str) -> str:
        return user

    async def embed(self, text: str) -> list[float]:
        buckets = [0.0] * getattr(get_settings(), "embedding_dimension", 1024)
        for index, char in enumerate(text.lower()):
            buckets[index % len(buckets)] += (ord(char) % 31) / 31
        norm = sum(value * value for value in buckets) ** 0.5 or 1
        return [value / norm for value in buckets]


def get_llm_provider() -> LLMProvider:
    settings = get_settings()
    provider = (getattr(settings, "model_provider", None) or settings.ai_provider).lower()
    if getattr(settings, "demo_mode", False) or getattr(settings, "app_env", "").lower() == "test":
        return DeterministicFallbackProvider()
    if provider == "ollama":
        return OllamaProvider()
    return DeterministicFallbackProvider()
