# Contributing to UniMate

Thanks for your interest in UniMate! 👋

UniMate is a personal project authored and maintained solely by **Sahaj Sinha**,
released under a proprietary [no‑modification license](LICENSE). Because of that
license, **external code contributions (pull requests that modify the Software)
cannot be accepted or merged.**

That said, your feedback is genuinely welcome:

## How you can help

- **🐛 Report bugs** — open a [GitHub Issue](../../issues) describing what you
  expected, what happened, and how to reproduce it.
- **💡 Suggest ideas** — open an Issue with the `enhancement` label.
- **🔐 Report security problems** — please follow the private process in
  [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Running the project locally (for evaluation)

The [README](README.md) covers full setup. The short version on Windows:

```bat
install.bat   :: installs frontend + backend dependencies
start.bat     :: launches the API and the web app
```

Or manually:

```bash
npm install
python -m venv backend/.venv
backend/.venv/Scripts/activate            # Windows
pip install -r backend/requirements-dev.txt
```

## Coding standards (for reference)

If you fork for personal, non‑commercial evaluation as permitted by the license:

- **Frontend:** TypeScript strict mode — type-check with `npm run build`
- **Backend:** `ruff check .` and `black .` from `backend/` (installed via `requirements-dev.txt`)
- **Tests:** `npm run test:frontend` and `npm run test:backend`

By interacting with this repository you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).
