import asyncio
import json

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.models.tables import ApprovalStatus, DocumentChunk, SourceDocument
from app.rag import retriever
from app.services.llm import DeterministicFallbackProvider


class FailingProvider:
    async def embed(self, text: str) -> list[float]:
        raise RuntimeError("embedding service unavailable")


def memory_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def add_document(session: Session, title: str, text: str) -> None:
    provider = DeterministicFallbackProvider()
    document = SourceDocument(
        url=f"https://example.edu/{title.lower().replace(' ', '-')}",
        title=title,
        raw_hash=title,
        raw_text=text,
        status=ApprovalStatus.approved,
    )
    session.add(document)
    session.commit()
    session.refresh(document)
    embedding = asyncio.run(provider.embed(text))
    session.add(
        DocumentChunk(
            document_id=document.id,
            chunk_index=0,
            text=text,
            embedding_json=json.dumps(embedding),
            is_active=True,
        )
    )
    session.commit()


def test_fallback_embeddings_do_not_return_unrelated_chunks(monkeypatch):
    monkeypatch.setattr(retriever, "get_llm_provider", lambda: FailingProvider())
    with memory_session() as session:
        add_document(session, "Dormitory Guide", "Dormitory applications open in March for international students.")

        chunks = asyncio.run(retriever.retrieve(session, "secret graduation exception", "en"))

    assert chunks == []


def test_fallback_embeddings_rank_lexically_related_chunks(monkeypatch):
    monkeypatch.setattr(retriever, "get_llm_provider", lambda: FailingProvider())
    with memory_session() as session:
        add_document(session, "Dormitory Guide", "Dormitory applications open in March for international students.")
        add_document(session, "Visa Guide", "Visa and ARC documents are handled by International Affairs.")

        chunks = asyncio.run(retriever.retrieve(session, "visa ARC documents", "en"))

    assert chunks[0].title == "Visa Guide"
    assert chunks[0].score >= 0.6
