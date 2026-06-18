from types import SimpleNamespace

import pytest

from app.services import llm


def settings(provider: str):
    return SimpleNamespace(
        app_env="development",
        demo_mode=False,
        model_provider=provider,
        ai_provider=provider,
        ollama_base_url="http://localhost:11434",
        ollama_chat_model="llama3.2:3b",
        ollama_embedding_model="bge-m3",
        ollama_embed_model="bge-m3",
        embedding_dimension=1024,
    )


def test_get_llm_provider_supports_ollama(monkeypatch):
