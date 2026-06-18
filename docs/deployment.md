# Deployment Guide

## Option 1: Low-Cost Prototype

- Frontend: Vercel or Netlify.
- Backend: Render, Railway, or Fly.io.
- Database: PostgreSQL with pgvector. Supabase PostgreSQL + pgvector is a supported future hosted option, but the current local development path remains Docker Compose with `pgvector/pgvector:pg16`.
- AI: local Ollama for demo machines or custom Ollama instance.
- Set frontend `VITE_API_BASE_URL` to the backend URL.

## Option 2: Google Cloud / Firebase Production

- Frontend: Firebase Hosting.
- Backend: Cloud Run.
- Database: Cloud SQL PostgreSQL with pgvector.
- Scheduler: Cloud Scheduler triggers `/api/admin/crawl`.
- Raw documents: Cloud Storage.
- Secrets: Secret Manager.
- AI: Ollama adapter.

## Option 3: University-Controlled Deployment

- Copy `.env.example` to `.env` and replace `JWT_SECRET`, database credentials, frontend origin, and model settings before exposing any service.
- Set `VITE_API_BASE_URL` before building the frontend image because Vite embeds this value at build time.
- Run `docker compose config` and fix any interpolation or syntax errors before building.
- Run `docker compose up --build`.
- Keep PostgreSQL and raw crawl artifacts inside the university network.
- Use Ollama or a private model endpoint.
- Enable admin source approval before publishing updated policy chunks.

## Release Verification Order

1. Start the local DBMS: `docker compose --env-file .env.example up -d db`.
2. Apply migrations: `cd backend && alembic upgrade head`.
3. Bootstrap an admin if needed: `python scripts/setup_admin.py`.
4. Crawl allowlisted sources or import approved seed material.
5. Approve source documents in the admin workflow so their chunks are active.
6. Run `python scripts/pgvector_smoke.py --min-active-chunks 25 --json` with `DATABASE_URL` pointed at PostgreSQL, or `python scripts/pgvector_smoke.py --docker-compose --min-active-chunks 25 --json` when a local host PostgreSQL service conflicts with Docker port `5432`.
7. Run `npm run evaluate -- --mode offline` to verify dataset, schema, approvals, retrieval, and deterministic chat behavior without live model calls.
8. Run `npm run evaluate -- --mode live` on the release host when Ollama or another local model endpoint is expected to serve traffic.
9. Run `python scripts/release_check.py` for the laptop-friendly release gate, or `python scripts/release_check.py --strict` for Docker/pgvector plus live model enforcement.

The offline gate is intentionally non-live. It can prove that release data and deterministic RAG behavior are ready, but it cannot prove that Ollama has enough local memory to load `llama3.2:1b` or `bge-m3`. A live Ollama `500` containing `unable to allocate CPU buffer` means the service is reachable and the model failed to allocate local resources; treat that as live-unavailable until the host has enough free memory or smaller models are configured.

## Docker Notes

- `docker-compose.yml` expects a local `.env` file. The example file is only a template and should not be mounted into production containers.
- Local compose defaults can start without `.env`, but shared environments must provide one with non-default secrets.
- The bundled nginx frontend image serves React routes through `index.html`, so direct links such as `/chat` and `/admin` should work after refresh.
- `host.docker.internal` is configured for a local Ollama process on the host machine. Replace `OLLAMA_BASE_URL` with an internal model endpoint for server deployments.
- Compose healthchecks cover PostgreSQL, Redis, the FastAPI `/api/health` endpoint, and the frontend `/health` endpoint.
- Run `npm run test:backend`, `npm run test:frontend`, `npm run evaluate`, and `docker compose config` before publishing a new image.
- If disk space becomes tight, remove generated `frontend/dist`, `.pytest_cache`, `*.tsbuildinfo`, and stopped Docker build cache only after confirming you do not need the artifacts. Do not delete the `postgres_data` volume unless you intentionally want to remove the local crawled corpus.

## Option 4: Future App Store Packaging

- Keep the React app as the source of truth.
- Add Capacitor later with microphone and notification permissions.
- Use the existing PWA icons and splash guidance as the asset base.
- Test iOS safe-area, Android back behavior, and speech permission flows.
