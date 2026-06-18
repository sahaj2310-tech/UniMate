import asyncio

from app.rag import pipeline
from app.rag.retriever import RetrievedChunk
from app.services.llm import ModelUnavailableError


def chunk(score: float = 0.8) -> RetrievedChunk:
    return RetrievedChunk(
        text="Visa and documentation are handled by the student services office. Bring official documents.",
        title="Student Services Guide",
        url="https://example.com/services",
        language="en",
        score=score,
        last_updated="2026-05-25",
    )


class RecordingProvider:
    def __init__(self) -> None:
        self.system = ""
        self.user = ""

    async def chat(self, system: str, user: str) -> str:
        self.system = system
        self.user = user
        return "Use the student services office for documentation and support."

    async def embed(self, text: str) -> list[float]:
        return []


class UnavailableProvider:
    async def chat(self, system: str, user: str) -> str:
        raise ModelUnavailableError("Ollama is unavailable")

    async def embed(self, text: str) -> list[float]:
        return []


def test_grounded_answer_uses_source_only_prompt(monkeypatch):
    provider = RecordingProvider()
    monkeypatch.setattr(pipeline, "get_llm_provider", lambda: provider)

    answer = asyncio.run(pipeline.grounded_answer("What documents do I need for support?", [chunk()], "en"))

    assert "student services" in answer.lower()
    assert "using only the provided source excerpts" in provider.system
    assert "Do not use outside knowledge" in provider.system
    assert "Student Services Guide" in provider.user
    assert "https://example.com/services" in provider.user


def test_grounded_answer_has_explicit_extractive_fallback_when_model_unavailable(monkeypatch):
    monkeypatch.setattr(pipeline, "get_llm_provider", lambda: UnavailableProvider())

    answer = asyncio.run(pipeline.grounded_answer("What documents do I need for support?", [chunk()], "en"))

    assert "Local answer model is unavailable" in answer
    assert "quotes only retrieved official source excerpts" in answer
    assert "Visa and documentation" in answer


def test_answer_question_returns_citations_for_grounded_answer(monkeypatch):
    async def fake_retrieve(session, question, language):
        return [chunk()]

    monkeypatch.setattr(pipeline, "retrieve", fake_retrieve)
    monkeypatch.setattr(pipeline, "get_llm_provider", lambda: UnavailableProvider())

    response = asyncio.run(pipeline.answer_question(None, "What documents do I need for support?", "en"))

    assert response.confidence == "medium"
    assert response.citations[0].title == "Student Services Guide"
    assert response.citations[0].url == "https://example.com/services"
    assert response.routed_office is not None


def test_sensitive_question_with_weak_sources_requires_handoff(monkeypatch):
    async def fake_retrieve(session, question, language):
        return [chunk(score=0.1)]

    monkeypatch.setattr(pipeline, "retrieve", fake_retrieve)

    response = asyncio.run(pipeline.answer_question(None, "Can I ignore my visa deadline?", "en"))

    assert response.requires_handoff is True
    assert response.confidence == "low"
    assert "could not verify" in response.answer.lower()
    assert response.citations
