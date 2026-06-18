# Security Policy

The UniMate team takes the security of this project and its users seriously. Thank you for helping keep it and the people who rely on it safe.

## Supported versions

This project follows a rolling release on the default branch. Security fixes are applied to the latest release.

| Version | Supported |
|---------|-----------|
| `1.x` (latest) | ✅ |
| < `1.0` | ❌ |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, report them privately using one of the following:

- **GitHub Security Advisories** (preferred): open a private report via the repository's **Security → Report a vulnerability** tab.
- **Private contact:** reach the maintainer directly through their GitHub profile.

Please include as much of the following as you can:

- A description of the vulnerability and its impact.
- Steps to reproduce, or a proof of concept.
- Affected component(s) (e.g., backend API, crawler, admin auth, frontend).
- Any suggested remediation.

## What to expect

- **Acknowledgement** within 3 business days.
- **Initial assessment** and severity triage within 7 business days.
- **Coordinated disclosure:** we will keep you informed of remediation progress and agree on a public disclosure timeline once a fix is available. Please give us a reasonable window to patch before any public disclosure.

We will credit reporters who wish to be acknowledged.

## Scope

In scope:

- The backend API (`backend/`), including authentication, rate limiting, the RAG pipeline, and the crawler.
- The frontend application (`frontend/`).
- Configuration and deployment artifacts in this repository (Docker, environment handling).

Out of scope:

- Vulnerabilities in third-party dependencies (please report those upstream; we will update affected dependencies).
- Issues requiring physical access to a user's device.
- Social engineering of project maintainers or users.

## Security model

This project is designed with several safeguards in place — prompt-injection and sensitive-topic guards, a mandatory source-verification fallback, JWT-based admin auth, and request rate limiting. For the detailed threat model and how these controls work, see [`docs/security.md`](docs/security.md).

## Handling of secrets

Never commit secrets. Only `.env.example` is tracked; real `.env` files are gitignored. If you discover a committed secret, report it privately using the process above.
