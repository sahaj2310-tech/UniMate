import json
import math
import re
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy import text as sql_text
from sqlmodel import Session, select
from app.core.config import get_settings
from app.models.tables import DocumentChunk, SourceDocument
from app.multilingual.languages import rewrite_queries
from app.services.llm import DeterministicFallbackProvider, get_llm_provider


@dataclass
class RetrievedChunk:
    text: str
    title: str
    url: str
    language: str
    score: float
    last_updated: str | None


STOPWORDS = {
    "about",
    "after",
    "before",
    "could",
    "from",
    "have",
    "into",
    "please",
    "policy",
    "requirements",
    "that",
    "the",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "unimate",
    "would",
}


def tokenize(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", text.lower()) if len(token) > 2 and token not in STOPWORDS}


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0
    size = min(len(a), len(b))
    dot = sum(a[i] * b[i] for i in range(size))
    left = math.sqrt(sum(a[i] * a[i] for i in range(size))) or 1
    right = math.sqrt(sum(b[i] * b[i] for i in range(size))) or 1
    return dot / (left * right)


def lexical_score(query: str, text: str) -> float:
    query_tokens = tokenize(query)
    if not query_tokens:
        return 0
    text_tokens = tokenize(text)
    overlap = len(query_tokens & text_tokens) / len(query_tokens)
    phrase_boost = 0.2 if query.lower() in text.lower() else 0
    return min(overlap + phrase_boost, 1.0)


def vector_literal(embedding: list[float]) -> str:
    return "[" + ",".join(f"{value:.8g}" for value in embedding) + "]"


def vector_similarity(distance: float | None) -> float:
    if distance is None:
        return 0
    return max(0.0, 1.0 - float(distance))


def build_retrieved_chunk(
    text: str,
    title: str,
    url: str,
    language: str,
    score: float,
    last_crawled_at: datetime | None,
) -> RetrievedChunk:
    return RetrievedChunk(
        text=text,
        title=title,
        url=url,
        language=language,
        score=score,
        last_updated=last_crawled_at.date().isoformat() if last_crawled_at else None,
    )


def retrieve_with_python_scoring(
    session: Session,
    query: str,
    embeddings: list[list[float]],
    using_fallback_embeddings: bool,
    top_k: int,
) -> list[RetrievedChunk]:
    statement = (
        select(DocumentChunk, SourceDocument)
        .join(SourceDocument, SourceDocument.id == DocumentChunk.document_id)
        .where(DocumentChunk.is_active == True)  # noqa: E712
        .where(SourceDocument.status == "approved")
    )
    rows = session.exec(statement).all()
    scored: list[RetrievedChunk] = []
    for chunk, document in rows:
        try:
            chunk_embedding = json.loads(chunk.embedding_json)
        except json.JSONDecodeError:
            chunk_embedding = []
        vector_score = max((cosine(embedding, chunk_embedding) for embedding in embeddings), default=0)
        text_score = lexical_score(query, chunk.text)
        score = text_score if using_fallback_embeddings else max(vector_score, text_score)
        scored.append(
            build_retrieved_chunk(
                text=chunk.text,
                title=document.title,
                url=document.url,
                language=document.language,
                score=score,
                last_crawled_at=document.last_crawled_at,
            )
        )
    matches = [item for item in scored if item.score > 0]
    return sorted(matches, key=lambda item: item.score, reverse=True)[:top_k]


def retrieve_with_postgres_vectors(
    session: Session,
    query: str,
    embeddings: list[list[float]],
    top_k: int,
) -> list[RetrievedChunk]:
    candidates: dict[int, RetrievedChunk] = {}
    limit = max(top_k * 8, top_k)
    statement = sql_text(
        """
        SELECT
            dc.id AS chunk_id,
            dc.text AS chunk_text,
            sd.title AS title,
            sd.url AS url,
            sd.language AS language,
            sd.last_crawled_at AS last_crawled_at,
            dc.embedding_vector <=> CAST(:embedding AS vector) AS distance
        FROM document_chunks AS dc
        JOIN sourcedocument AS sd ON sd.id = dc.document_id
        WHERE dc.is_active = true
          AND sd.status = 'approved'
          AND dc.embedding_vector IS NOT NULL
        ORDER BY dc.embedding_vector <=> CAST(:embedding AS vector)
        LIMIT :limit
        """
    )
    for embedding in embeddings:
        rows = session.execute(statement, {"embedding": vector_literal(embedding), "limit": limit}).all()
        for row in rows:
            vector_score = vector_similarity(row.distance)
            text_score = lexical_score(query, row.chunk_text)
            score = max(vector_score, text_score)
            existing = candidates.get(row.chunk_id)
            if existing is None or score > existing.score:
                candidates[row.chunk_id] = build_retrieved_chunk(
                    text=row.chunk_text,
                    title=row.title,
                    url=row.url,
                    language=row.language,
                    score=score,
                    last_crawled_at=row.last_crawled_at,
                )
    matches = [item for item in candidates.values() if item.score > 0]
    return sorted(matches, key=lambda item: item.score, reverse=True)[:top_k]


async def retrieve(session: Session, query: str, language: str, top_k: int = 5) -> list[RetrievedChunk]:
    provider = get_llm_provider()
    settings = get_settings()
    queries = await rewrite_queries(query, language)
    embeddings: list[list[float]] = []
    using_fallback_embeddings = False
    for item in queries:
        try:
            embeddings.append(await provider.embed(item))
        except Exception:
            using_fallback_embeddings = True
            if not isinstance(provider, DeterministicFallbackProvider) and not (settings.demo_mode or settings.app_env.lower() == "test"):
                raise
            embeddings.append(await DeterministicFallbackProvider().embed(item))

    if session.get_bind().dialect.name == "postgresql" and not using_fallback_embeddings:
        return retrieve_with_postgres_vectors(session, query, embeddings, top_k)
    return retrieve_with_python_scoring(session, query, embeddings, using_fallback_embeddings, top_k)
