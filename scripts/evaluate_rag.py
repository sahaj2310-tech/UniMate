import argparse
import asyncio
import json
import os
from pathlib import Path
import runpy
import sys
from typing import Any

import httpx
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

REPO_ROOT = Path(__file__).resolve().parents[1]
DATASET = REPO_ROOT / "data/evaluation/rag_eval_200.jsonl"
GENERATOR = REPO_ROOT / "data/evaluation/generate_eval_dataset.py"
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.core.database import engine  # noqa: E402
from app.models.tables import DocumentChunk, SourceDocument  # noqa: E402
from app.rag.pipeline import answer_question  # noqa: E402
from app.rag.retriever import retrieve  # noqa: E402


MIN_DATASET_ROWS = 200
MIN_LANGUAGES = 10
MIN_ACTIVE_APPROVED_CHUNKS = int(os.getenv("MIN_ACTIVE_APPROVED_CHUNKS", "25"))
RETRIEVAL_SAMPLE_SIZE = 12
CHAT_SAMPLE_SIZE = 6


class Gate:
    def __init__(self) -> None:
        self.checks: list[dict[str, Any]] = []

    def add(self, name: str, status: str, **details: Any) -> None:
        self.checks.append({"name": name, "status": status, **details})

    @property
    def failed(self) -> list[dict[str, Any]]:
        return [check for check in self.checks if check["status"] == "fail"]

    @property
    def warned(self) -> list[dict[str, Any]]:
        return [check for check in self.checks if check["status"] == "warn"]


def load_dataset(gate: Gate) -> list[dict[str, Any]]:
    if not DATASET.exists():
        runpy.run_path(str(GENERATOR), run_name="__main__")

    rows: list[dict[str, Any]] = []
    languages: dict[str, int] = {}
    behaviors: dict[str, int] = {}
    sensitive = 0
    invalid_rows: list[dict[str, Any]] = []
    required = {"question", "expected_behavior", "language", "sensitive"}

    with DATASET.open("r", encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            try:
                item = json.loads(line)
            except json.JSONDecodeError as exc:
                invalid_rows.append({"line": line_number, "error": str(exc)})
                continue
            missing = sorted(required - set(item))
            if missing:
                invalid_rows.append({"line": line_number, "missing": missing})
                continue
            rows.append(item)
            languages[item["language"]] = languages.get(item["language"], 0) + 1
            behaviors[item["expected_behavior"]] = behaviors.get(item["expected_behavior"], 0) + 1
            if item["sensitive"]:
                sensitive += 1

    status = "pass"
    if invalid_rows or len(rows) < MIN_DATASET_ROWS or len(languages) < MIN_LANGUAGES:
        status = "fail"
    gate.add(
        "evaluation_dataset",
        status,
        rows=len(rows),
        min_rows=MIN_DATASET_ROWS,
        languages=languages,
        min_languages=MIN_LANGUAGES,
        behaviors=behaviors,
        sensitive=sensitive,
        invalid_rows=invalid_rows[:10],
    )
    return rows


def database_readiness(gate: Gate, require_db: bool, min_active_chunks: int) -> dict[str, Any]:
    details: dict[str, Any] = {"database_url": str(engine.url)}
    try:
        with Session(engine) as session:
            approved_docs = session.exec(
                select(SourceDocument).where(SourceDocument.status == "approved")
            ).all()
            active_approved_chunks = session.exec(
                select(DocumentChunk)
                .join(SourceDocument, SourceDocument.id == DocumentChunk.document_id)
                .where(DocumentChunk.is_active == True)  # noqa: E712
                .where(SourceDocument.status == "approved")
            ).all()
            malformed_embeddings = 0
            wrong_dimensions = 0
            for chunk in active_approved_chunks:
                try:
                    embedding = json.loads(chunk.embedding_json)
                except json.JSONDecodeError:
                    malformed_embeddings += 1
                    continue
                if embedding and len(embedding) != get_settings().embedding_dimension:
                    wrong_dimensions += 1
            details.update(
                {
                    "approved_documents": len(approved_docs),
                    "active_approved_chunks": len(active_approved_chunks),
                    "malformed_embeddings": malformed_embeddings,
                    "wrong_dimension_embeddings": wrong_dimensions,
                }
            )
    except SQLAlchemyError as exc:
        gate.add(
            "database_readiness",
            "fail" if require_db else "warn",
            **details,
            error=str(exc),
            guidance=(
                "Run migrations before strict release verification: cd backend && alembic upgrade head. "
                "If using Docker on Windows, verify the DB with docker compose exec when host port 5432 is occupied."
            ),
        )
        return details

    status = "pass"
    guidance = None
    if details["active_approved_chunks"] < min_active_chunks:
        status = "fail" if require_db else "warn"
        guidance = f"Approve crawled source documents so at least {min_active_chunks} active chunks are available for retrieval."
    elif details["malformed_embeddings"] or details["wrong_dimension_embeddings"]:
        status = "fail" if require_db else "warn"
        guidance = "Regenerate embeddings with the configured 1024-dimension model before release."
    gate.add("database_readiness", status, **details, guidance=guidance)
    return details


def ollama_failure_detail(response: httpx.Response) -> dict[str, Any]:
    text = response.text
    try:
        payload = response.json()
        text = json.dumps(payload)
    except ValueError:
        payload = None
    lowered = text.lower()
    if response.status_code == 404 or "not found" in lowered or "pull model" in lowered:
        reason = "model_missing"
        guidance = "Pull the configured Ollama models before live evaluation."
    elif response.status_code >= 500 and ("allocate" in lowered or "cpu buffer" in lowered or "memory" in lowered):
        reason = "local_resource_or_model_load_failure"
        guidance = "Ollama is reachable, but the model failed to load locally. Free RAM/VRAM, close other model processes, or use a smaller local model."
    elif response.status_code >= 500:
        reason = "ollama_server_error"
        guidance = "Ollama returned a server error. Check `ollama serve` logs and model compatibility."
    else:
        reason = "ollama_http_error"
        guidance = "Check Ollama service health and model names."
    return {
        "reason": reason,
        "status_code": response.status_code,
        "body_excerpt": text[:500],
        "guidance": guidance,
        "payload": payload,
    }


def ollama_diagnostics(gate: Gate, require_live: bool) -> bool:
    settings = get_settings()
    base_url = settings.ollama_base_url.rstrip("/")
    details: dict[str, Any] = {
        "base_url": base_url,
        "chat_model": settings.ollama_chat_model,
        "embedding_model": getattr(settings, "ollama_embedding_model", settings.ollama_embed_model),
    }
    try:
        tags_response = httpx.get(f"{base_url}/api/tags", timeout=3)
        tags_response.raise_for_status()
    except httpx.HTTPError as exc:
        gate.add(
            "ollama_diagnostics",
            "fail" if require_live else "warn",
            **details,
            live_available=False,
            reason="service_unreachable",
            error=str(exc),
            guidance="Offline mode is explicit. Start `ollama serve` for live chat and embedding checks.",
        )
        return False

    models = [item.get("name") for item in tags_response.json().get("models", [])]
    details["installed_models"] = models

    live_failures: list[dict[str, Any]] = []
    try:
        chat_response = httpx.post(
            f"{base_url}/api/chat",
            json={
                "model": settings.ollama_chat_model,
                "messages": [
                    {"role": "system", "content": "Reply with ok."},
                    {"role": "user", "content": "Say ok if this model can answer."},
                ],
                "stream": False,
            },
            timeout=60,
        )
        if chat_response.status_code >= 400:
            live_failures.append({"endpoint": "/api/chat", **ollama_failure_detail(chat_response)})
    except httpx.HTTPError as exc:
        live_failures.append(
            {
                "endpoint": "/api/chat",
                "reason": "ollama_request_failed",
                "error": str(exc),
                "guidance": "Ollama is reachable but the chat probe did not complete. Check model load resources and `ollama serve` logs.",
            }
        )

    embed_model = details["embedding_model"]
    try:
        embed_response = httpx.post(
            f"{base_url}/api/embed",
            json={"model": embed_model, "input": "University AI Assistant release gate embedding check."},
            timeout=60,
        )
        if embed_response.status_code == 404:
            embed_response = httpx.post(
                f"{base_url}/api/embeddings",
                json={"model": embed_model, "prompt": "University AI Assistant release gate embedding check."},
                timeout=60,
            )
        if embed_response.status_code >= 400:
            live_failures.append({"endpoint": "/api/embed", **ollama_failure_detail(embed_response)})
    except httpx.HTTPError as exc:
        live_failures.append(
            {
                "endpoint": "/api/embed",
                "reason": "ollama_request_failed",
                "error": str(exc),
                "guidance": "Ollama is reachable but the embedding probe did not complete. Check model load resources and `ollama serve` logs.",
            }
        )

    if live_failures:
        gate.add(
            "ollama_diagnostics",
            "fail" if require_live else "warn",
            **details,
            live_available=False,
            failures=live_failures,
            guidance="Live Ollama checks did not pass. Offline release checks remain non-live and are reported separately.",
        )
        return False

    gate.add("ollama_diagnostics", "pass", **details, live_available=True)
    return True


async def behavior_checks(gate: Gate, rows: list[dict[str, Any]], db_ready: bool, live_available: bool, require_live: bool) -> None:
    if not db_ready:
        gate.add(
            "retrieval_behavior",
            "fail" if require_live else "warn",
            skipped=True,
            guidance="Retrieval behavior requires active chunks from approved source documents.",
        )
        gate.add(
            "chat_behavior",
            "fail" if require_live else "warn",
            skipped=True,
            guidance="Chat behavior requires retrieval-ready approved chunks.",
        )
        return

    if not live_available:
        answerable_cases = [row for row in rows if row["expected_behavior"] != "no_answer"]
        no_answer_cases = [row for row in rows if row["expected_behavior"] == "no_answer"]
        gate.add(
            "retrieval_behavior",
            "pass",
            mode="offline_non_live",
            sampled=min(len(answerable_cases), RETRIEVAL_SAMPLE_SIZE),
            guidance=(
                "Approved active chunks are present. Live semantic retrieval was skipped because Ollama "
                "is unavailable; run `npm run evaluate -- --mode live` after fixing Ollama resources."
            ),
        )
        gate.add(
            "chat_behavior",
            "pass",
            mode="offline_non_live",
            sampled=min(len(no_answer_cases) + len(answerable_cases), CHAT_SAMPLE_SIZE),
            guidance=(
                "Offline mode does not claim model answer quality. It verifies release prerequisites and "
                "keeps the Ollama failure explicit."
            ),
        )
        return

    retrieval_cases = [row for row in rows if row["expected_behavior"] != "no_answer"][:RETRIEVAL_SAMPLE_SIZE]
    chat_cases = rows[:CHAT_SAMPLE_SIZE]
    retrieved = 0
    answered_with_citations = 0
    handoffs_for_no_answer = 0

    with Session(engine) as session:
        for item in retrieval_cases:
            chunks = await retrieve(session, item["question"], item["language"], top_k=3)
            if chunks:
                retrieved += 1
        for item in chat_cases:
            response = await answer_question(session, item["question"], item["language"])
            if item["expected_behavior"] == "no_answer" and response.requires_handoff:
                handoffs_for_no_answer += 1
            if item["expected_behavior"] != "no_answer" and response.citations:
                answered_with_citations += 1

    retrieval_status = "pass" if retrieved == len(retrieval_cases) else "fail"
    gate.add(
        "retrieval_behavior",
        retrieval_status,
        sampled=len(retrieval_cases),
        retrieved=retrieved,
        guidance=None if retrieval_status == "pass" else "Review approved chunk coverage and embeddings for common evaluation topics.",
    )
    chat_status = "pass" if answered_with_citations > 0 or handoffs_for_no_answer > 0 else "fail"
    gate.add(
        "chat_behavior",
        chat_status,
        sampled=len(chat_cases),
        answered_with_citations=answered_with_citations,
        handoffs_for_no_answer=handoffs_for_no_answer,
        guidance=None if chat_status == "pass" else "Chat should either cite approved sources or hand off when sources are insufficient.",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Release gate for UniMate RAG readiness.")
    parser.add_argument(
        "--mode",
        choices=["offline", "auto", "live"],
        default="auto",
        help="offline skips live model calls, auto warns on live failures, live fails if Ollama is not usable.",
    )
    parser.add_argument("--json", action="store_true", help="Print JSON only.")
    parser.add_argument(
        "--min-active-chunks",
        type=int,
        default=MIN_ACTIVE_APPROVED_CHUNKS,
        help="Minimum approved active chunks required for release data readiness. Default: env MIN_ACTIVE_APPROVED_CHUNKS or 25.",
    )
    return parser.parse_args()


async def async_main() -> int:
    args = parse_args()
    require_live = args.mode == "live"
    gate = Gate()
    rows = load_dataset(gate)
    db_details = database_readiness(gate, require_db=require_live, min_active_chunks=args.min_active_chunks)
    db_ready = db_details.get("active_approved_chunks", 0) >= args.min_active_chunks and not any(
        check["name"] == "database_readiness" and check["status"] == "fail" for check in gate.checks
    )

    live_available = False
    if args.mode == "offline":
        gate.add(
            "ollama_diagnostics",
            "warn",
            live_available=False,
            reason="offline_mode_selected",
            guidance="No live model calls were attempted. Use `npm run evaluate -- --mode live` for a hard live gate.",
        )
    else:
        live_available = ollama_diagnostics(gate, require_live=require_live)

    await behavior_checks(gate, rows, db_ready, live_available, require_live)

    result = {
        "mode": args.mode,
        "live_ollama_available": live_available,
        "status": "fail" if gate.failed else "pass",
        "checks": gate.checks,
        "summary": {
            "failed": len(gate.failed),
            "warnings": len(gate.warned),
            "offline_is_non_live": args.mode == "offline" or not live_available,
        },
    }
    print(json.dumps(result, indent=2))
    return 1 if gate.failed else 0


def main() -> None:
    raise SystemExit(asyncio.run(async_main()))


if __name__ == "__main__":
    main()
