import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def run_step(name: str, command: list[str]) -> dict:
    executable = shutil.which(command[0])
    if executable is None:
        return {
            "name": name,
            "status": "fail",
            "command": command,
            "error": f"Executable not found: {command[0]}",
        }
    completed = subprocess.run(
        [executable, *command[1:]],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    return {
        "name": name,
        "status": "pass" if completed.returncode == 0 else "fail",
        "command": command,
        "returncode": completed.returncode,
        "output_tail": completed.stdout[-4000:],
    }


def main() -> int:
    strict = "--strict" in sys.argv
    include_docker = "--include-docker" in sys.argv or strict
    steps = [
        ("backend_tests", ["npm", "run", "test:backend"]),
        ("frontend_tests", ["npm", "run", "test:frontend"]),
        ("frontend_build", ["npm", "run", "build"]),
        (
            "rag_release_gate",
            ["python", "scripts/evaluate_rag.py", "--mode", "live" if strict else "auto", "--min-active-chunks", "25"],
        ),
    ]
    if include_docker:
        steps.extend(
            [
                ("docker_compose_config", ["docker", "compose", "--env-file", ".env.example", "config"]),
                ("pgvector_smoke", ["python", "scripts/pgvector_smoke.py", "--docker-compose", "--min-active-chunks", "25"]),
            ]
        )
    results = [run_step(name, command) for name, command in steps]
    failed = [result for result in results if result["status"] == "fail"]
    print(json.dumps({"status": "fail" if failed else "pass", "results": results}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
