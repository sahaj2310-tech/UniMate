# Release Verification

Use this checklist before publishing a Docker image or handing the system to a demo host.

## Required Sequence

1. Configure `.env` from `.env.example` and replace all deployment secrets.
2. Start Docker PostgreSQL: `docker compose --env-file .env.example up -d db`.
3. Apply migrations with `cd backend && alembic upgrade head`.
4. Bootstrap an admin with `python scripts/setup_admin.py` if the staff dashboard has no user.
5. Crawl or import allowlisted source material.
6. Approve reviewed source documents in the admin workflow.
7. Run `python scripts/pgvector_smoke.py --min-active-chunks 25 --json` with `DATABASE_URL` pointed at PostgreSQL, or use `--docker-compose` if another local PostgreSQL service conflicts with host port `5432`.
8. Run `npm run evaluate -- --mode offline`.
9. Run `npm run evaluate -- --mode live` on any host that is expected to answer with local Ollama.
10. Run `python scripts/release_check.py`, or `python scripts/release_check.py --strict` for Docker/pgvector plus live model enforcement.

## Evaluation Modes

- `offline`: no live model calls. This validates the evaluation fixture, database schema, approved active chunks, retrieval, and deterministic chat behavior. It is useful in CI and on laptops without a running model server.
- `auto`: default mode. This performs the offline gate and attempts Ollama diagnostics when Ollama is reachable. Live failures are reported clearly but do not hide the offline result.
- `live`: hard live gate. Ollama chat and embedding model checks must pass.

## Ollama Diagnostics

The evaluator probes `/api/tags`, `/api/chat`, and embedding generation. If `/api/chat` with `llama3.2:1b` or `/api/embed` with `bge-m3` returns `500` with text such as `unable to allocate CPU buffer`, the model server is reachable but the local machine cannot allocate enough resources to load the model. Treat that as live Ollama unavailable. Free memory, stop other model processes, or configure smaller models before release.

Missing models are reported separately and should be fixed with:

```bash
ollama pull llama3.2:1b
ollama pull llama3.2:3b
ollama pull bge-m3
```

## Pass Criteria

- Dataset has at least 200 valid rows across at least 10 languages.
- Migrations have created the source, chunk, and approval tables.
- At least 25 approved active chunks are present for a local demo release, unless intentionally overridden with `MIN_ACTIVE_APPROVED_CHUNKS` or `--min-active-chunks` in a test fixture.
- Active embeddings are valid JSON and match the configured 1024 dimensions when present.
- Retrieval finds chunks for sampled answerable cases.
- Chat returns citations for sourced answers or handoff behavior for insufficient-source cases.
- `docker compose config` renders successfully.
- `document_chunks.embedding_vector` is `vector(1024)` and `ix_document_chunks_embedding_vector_hnsw` exists on PostgreSQL.
