# Data Ingestion Guide

Initial allowlist:

- `https://example.com/main/index.html`
- `https://example.com/page/index.html?code=0206`
- `https://example.com/page/index.html?code=0302`
- `https://example.com/page/index.html?code=040403a`
- `https://example.com/page/index.html?code=050101a`
- `https://example.com/department/events`
- `https://example.com/housing/`
- `https://example.com/services/`

Pipeline:

1. Check domain allowlist and exclusion rules.
2. Respect `robots.txt` and crawl-delay configuration.
3. Fetch page using the configured user agent.
4. Remove nav, footer, scripts, styles, and prompt-injection-like text.
5. Detect language and hash content.
6. Chunk text with overlap.
7. Generate embeddings through the configured provider.
8. Store source documents and chunks.
9. Mark chunks inactive until approval when `CRAWL_REQUIRE_APPROVAL=true`.
10. Admin approves or rejects source documents.

URL normalization:

- `http://example.com/...` is canonicalized to `https://example.com/...` before crawling and storage.
- URL fragments are removed before allowlist checks and deduplication.

Retrieval storage:

- PostgreSQL deployments use the `embedding_vector` pgvector column for cosine-distance candidate lookup.
- SQLite and tests continue to use the JSON embedding column with Python scoring.
- Migration `0002_pgvector_hnsw_index` attempts to add an HNSW cosine index for active chunks when pgvector index support is available; it skips safely on non-PostgreSQL or incompatible environments.

## Migration And Approval Requirements

Run `cd backend && alembic upgrade head` before ingestion. The crawler and evaluator require the `sourcedocument`, `document_chunks`, and approval tables from the migrations. If any of those tables are missing, release evaluation fails and points back to migrations.

When `CRAWL_REQUIRE_APPROVAL=true`, crawled content is not eligible for student-facing answers until an admin approves the source document. Approval changes the source status to `approved` and activates that document's chunks. Rejection keeps chunks inactive. The release gate checks for active chunks joined to approved source documents, so a database with crawled-but-pending content is correctly treated as not ready.

Before deployment, review representative sources for high-risk topics such as visa, scholarship, grades, attendance, housing, and payment. Sensitive or conflicting policy areas should retain human handoff behavior unless the approved source text is specific enough to cite.

Commercial deployment should request official permission before broad crawling.
