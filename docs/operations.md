# Operations Runbook

Operational procedures for running, verifying, and releasing UniMate. For a quick start, see the [README](../README.md). For architecture, see [architecture.md](architecture.md).

## Local commands

```bash
cd unimate
cp .env.example .env
npm install
npm run dev
```

Backend:

```bash
cd unimate/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

Ollama local setup:

```bash
ollama pull llama3.2:3b
ollama pull bge-m3
ollama serve
```

The backend uses `llama3.2:3b` for chat and `bge-m3` for embeddings by default. Larger 8B-class models are intentionally not the default and should only be considered later for stronger hardware.

Docker:

```bash
cd unimate
cp .env.example .env
docker compose up --build
```

The compose file can render with built-in defaults, but a real `.env` is required for any shared or production deployment. The frontend API URL is compiled by Vite during the Docker build. For a deployed backend, set `VITE_API_BASE_URL` in `.env` before running `docker compose up --build`.

## How to verify the DBMS is running

The database service is named `db`. It uses `pgvector/pgvector:pg16`, exposes port `5432`, uses database `unimate`, username `user`, and stores data in the named volume `postgres_data`.

```bash
docker compose --env-file .env.example config
docker compose --env-file .env.example up -d db
docker compose ps
docker compose logs db
```

Create the pgvector extension and app tables with migrations:

```bash
cd backend
alembic upgrade head
cd ..
```

Run migrations before any crawler, approval, or evaluation workflow. Alembic is the production schema path for PostgreSQL; `create_db_and_tables()` is kept only for SQLite/dev-test convenience. A database that only has partial tables is not release-ready; `npm run evaluate` will fail with migration guidance instead of silently treating missing RAG tables as empty data.

Verify PostgreSQL, pgvector, and tables:

```bash
docker compose exec db psql -U unimate_user -d unimate_db -c "SELECT version();"
docker compose exec db psql -U unimate_user -d unimate_db -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
docker compose exec db psql -U unimate_user -d unimate_db -c "\dt"
docker compose exec db psql -U unimate_user -d unimate_db -c "\d document_chunks"
```

Verify the vector column and local corpus:

```bash
docker compose exec db psql -U unimate_user -d unimate_db -c "SELECT version_num FROM alembic_version();"
docker compose exec db psql -U unimate_user -d unimate_db -c "SELECT status, COUNT(*) FROM sourcedocument GROUP BY status;"
docker compose exec db psql -U unimate_user -d unimate_db -c "SELECT is_active, COUNT(*) FROM document_chunks GROUP BY is_active;"
docker compose exec db psql -U unimate_user -d unimate_db -c "SELECT embedding_vector <=> embedding_vector FROM document_chunks WHERE embedding_vector IS NOT NULL LIMIT 1;"
```

To run the host-side pgvector smoke check against Docker PostgreSQL:

```bash
$env:DATABASE_URL="postgresql+psycopg://unimate_user:unimate_password@localhost:5432/unimate_db"
python scripts/pgvector_smoke.py --min-active-chunks 25 --json
```

If another local PostgreSQL service is already using host port `5432`, verify through the Docker network instead:

```bash
python scripts/pgvector_smoke.py --docker-compose --min-active-chunks 25 --json
```

## Admin bootstrap

```bash
$env:DATABASE_URL="postgresql+psycopg://unimate_user:unimate_password@localhost:5432/unimate_db"
$env:ADMIN_EMAIL="admin@example.edu"
$env:ADMIN_PASSWORD="replace-with-a-strong-password"
$env:ADMIN_ROLE="admin"
python scripts/setup_admin.py
```

The setup script refuses weak/default passwords and never prints the password. Use the created account on `/admin`; the dashboard validates sessions through `/api/admin/me`.

## Evaluation

```bash
cd unimate
python data/evaluation/generate_eval_dataset.py
npm run evaluate
python scripts/release_check.py
```

The current evaluation fixture contains 210 rows across 14 languages and 15 topic/behavior categories. `npm run evaluate` is a release gate, not a model benchmark. It checks dataset shape, migration/data readiness, active chunks from approved documents, deterministic retrieval/chat behavior, and Ollama diagnostics.

Evaluation modes:

```bash
npm run evaluate -- --mode offline
npm run evaluate -- --mode auto
npm run evaluate -- --mode live
```

- `offline` makes no live model calls and clearly reports that model generation/embedding was not verified.
- `auto` is the default. It runs live Ollama diagnostics when the service is reachable, but reports Ollama failures separately from offline RAG readiness.
- `live` fails the gate unless the configured Ollama chat and embedding models can answer/load successfully.

If Ollama returns `500` with text such as `unable to allocate CPU buffer`, the service is reachable but live model loading failed locally. Free memory, stop other model processes, or use a smaller model before treating live evaluation as passed.

## Crawler

```bash
cd unimate
python scripts/run_crawler.py --page-limit 40
python scripts/run_crawler.py --all-seeds --page-limit 25
```

For a local demo only, you can publish allowlisted crawl results immediately:

```bash
python scripts/run_crawler.py --all-seeds --page-limit 25 --approve-after-crawl
```

In production, keep source documents pending and approve them through the staff dashboard.

For commercial use, obtain official permission before broad crawling or deployment.
