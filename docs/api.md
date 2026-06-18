# API

Base URL: `http://localhost:8000`

- `GET /api/health`: service health.
- `GET /api/languages`: supported UI and response languages.
- `POST /api/chat`: source-grounded answer with citations, confidence, next actions, and handoff status.
- `POST /api/chat/stream`: server-sent event token stream.
- `POST /api/retrieve`: retrieve top chunks for a query.
- `POST /api/feedback`: save answer feedback.
- `POST /api/report-answer`: mark answer as problematic.
- `GET /api/sources`: list approved public source metadata only. This endpoint never returns raw source text, hashes, pending/rejected documents, or staff-review fields.
- `GET /api/notices`: list notices.
- `GET /api/offices`: list office contacts.
- `POST /api/translate`: provider-ready translation endpoint.
- `POST /api/notice-explainer`: summarize a notice in the selected language.
- `POST /api/checklist`: create a student-life checklist.
- `POST /api/handoff-ticket`: open a human support ticket.
- `POST /api/admin/login`: authenticate an active admin/reviewer and return a JWT.
- `GET /api/admin/me`: validate the current admin JWT and return the active admin identity.
- `GET /api/admin/sources`: list source documents for staff review, including pending/rejected records and review metadata.
- `POST /api/admin/sources`: add a pending source document. The server sanitizes text, computes `raw_hash`, and controls status/timestamps.
- `POST /api/admin/crawl`: run allowlisted crawler.
- `GET /api/admin/crawl-logs`: inspect crawl logs.
- `GET /api/admin/analytics`: dashboard metrics.
- `GET /api/admin/failed-queries`: FAQ gap mining.
- `POST /api/admin/approve-documents`: bulk-approve source documents and activate their chunks.
- `POST /api/admin/approve-document`: publish crawled source chunks.
- `POST /api/admin/reject-document`: reject source chunks.
- `POST /api/admin/faq`: queue FAQ entry for review.

Chat responses always include `answer`, `confidence`, `citations`, `related_pages`, `suggested_next_actions`, `requires_handoff`, `routed_office`, and `language`.
