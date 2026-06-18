# Security And Privacy

- LLM and embedding calls run server-side only.
- Frontend never receives provider API keys.
- CORS is restricted to configured frontend origins. Production must set `FRONTEND_ORIGIN` and optional comma-separated `CORS_ORIGINS`; local development origins are only added outside production.
- API rate limiting is enabled through SlowAPI with `API_RATE_LIMIT` defaulting to `120/minute`. High-abuse routes also have route-specific hooks for chat, streaming chat, retrieval, feedback, handoff tickets, admin login, and admin crawling.
- Admin login is database-backed through `AdminUser`; `/api/admin/login` issues signed JWT access tokens and `/api/admin/me` verifies the token against an active database user. Production refuses weak or placeholder `JWT_SECRET` values.
- Admin RBAC is role-specific: `admin` can manage sources, crawler jobs, and FAQ queue actions; `reviewer` can inspect analytics/crawl logs/failed queries and approve or reject source documents.
- Prompt-injection patterns are filtered from user messages and retrieved source text. Untrusted sources must not override system/developer instructions, request hidden prompts or credentials, fabricate policy/citations/deadlines, or bypass source verification.
- Sensitive topics require strong sources or human handoff.
- The app supports anonymous chat and avoids collecting unnecessary personal data.
- Feedback comments, failed queries, and handoff questions are minimized before persistence by redacting common emails, phone numbers, and student identifiers.
- Logs should avoid student record details in production.
- Future university deployment can use a private model endpoint and private network database.

Multilingual safety:

- Language codes are normalized server-side before retrieval or response generation, including common regional aliases such as `zh-Hant`, `zh-CN`, `kr`, and `jp`.
- Script-based detection handles common UNIMATE student languages before falling back to statistical detection.
- Translation and query rewriting use the server-side provider abstraction. The default local path is Ollama with `llama3.2:1b`; tests and demo mode can use safe deterministic fallbacks when Ollama is unavailable.
- Sensitive-topic detection includes expanded English, Korean, Vietnamese, Chinese, Japanese, Russian, Mongolian, Hindi, and Bangla high-risk student-service terms. Continue adding university-specific terms before production launch.

Required fallback:

> I could not verify this from the available UNIMATE University sources. Please contact the relevant office.
