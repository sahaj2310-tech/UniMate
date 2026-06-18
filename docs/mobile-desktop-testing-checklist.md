# Mobile And Desktop Testing Checklist

Mobile:

- Small phone at 360px width.
- iPhone Safari safe-area top and bottom.
- Android Chrome and Samsung Internet.
- Keyboard does not hide chat input.
- Touch targets are at least 44px.
- No horizontal scroll.
- Voice input feature detection works.
- TTS feature detection works.
- PWA install prompt works where supported.

Tablet:

- Layout remains readable in portrait and landscape.
- Bottom navigation and cards do not stretch awkwardly.

Desktop:

- Admin dashboard uses available width.
- Product board displays multiple screens cleanly.
- Keyboard focus order is logical.
- Charts render and tooltips work.

RAG:

- Answerable questions include citations.
- No-answer questions use the required fallback.
- Sensitive topics route to a human office.
- Conflicting sources recommend office confirmation.

Release smoke tests:

- `npm run test:backend` passes from the repository root.
- `npm run test:frontend` passes from the repository root.
- `npm run evaluate -- --mode offline` passes schema, approval, retrieval, and deterministic chat checks without making live model calls.
- `npm run evaluate -- --mode live` passes on the release host when Ollama is expected to serve production traffic.
- Ollama `500` errors that mention `unable to allocate CPU buffer` are treated as local resource/model-load failures, not as a passing live model check.
- `python scripts/release_check.py` passes and includes `docker compose config`.
- Docker build uses the intended `VITE_API_BASE_URL`; verify the compiled frontend against the deployed backend URL.
