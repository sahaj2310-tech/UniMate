import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify PostgreSQL + pgvector readiness for UniMate.")
    parser.add_argument("--min-active-chunks", type=int, default=25)
    parser.add_argument("--docker-compose", action="store_true", help="Run checks through docker compose exec db psql instead of a host DATABASE_URL.")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def run_docker_sql(sql: str) -> str:
    docker = shutil.which("docker")
    if docker is None:
        raise RuntimeError("Executable not found: docker")
    completed = subprocess.run(
        [docker, "compose", "exec", "-T", "db", "psql", "-U", "unimate_user", "-d", "unimate_db", "-t", "-A", "-c", sql],
        cwd=Path(__file__).resolve().parents[1],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stdout.strip())
    return completed.stdout.strip()


def docker_checks(min_active_chunks: int) -> list[dict]:
    checks: list[dict] = []
    vector_extension = run_docker_sql("SELECT extname FROM pg_extension WHERE extname='vector';")
    checks.append({"name": "vector_extension", "status": "pass" if vector_extension == "vector" else "fail"})

    vector_column = run_docker_sql(
        """
        SELECT format_type(a.atttypid, a.atttypmod)
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        WHERE c.relname = 'document_chunks'
          AND a.attname = 'embedding_vector'
          AND NOT a.attisdropped
        """
    )
    checks.append({"name": "embedding_vector_column", "status": "pass" if vector_column == "vector(1024)" else "fail", "type": vector_column})

    index_name = run_docker_sql("SELECT indexname FROM pg_indexes WHERE tablename='document_chunks' AND indexname='ix_document_chunks_embedding_vector_hnsw';")
    checks.append({"name": "hnsw_index", "status": "pass" if index_name else "fail", "index": index_name})

    distance = run_docker_sql("SELECT embedding_vector <=> embedding_vector FROM document_chunks WHERE embedding_vector IS NOT NULL LIMIT 1;")
    checks.append({"name": "vector_distance", "status": "pass" if distance in {'0', '0.0'} else "fail", "distance": distance})

    active_chunks = int(
        run_docker_sql(
            """
            SELECT COUNT(*)
            FROM document_chunks dc
            JOIN sourcedocument sd ON sd.id = dc.document_id
            WHERE dc.is_active = true
              AND sd.status = 'approved'
            """
        )
    )
    checks.append(
        {
            "name": "active_approved_chunks",
            "status": "pass" if active_chunks >= min_active_chunks else "fail",
            "count": active_chunks,
            "minimum": min_active_chunks,
        }
    )
    return checks


def sqlalchemy_checks(min_active_chunks: int) -> list[dict]:
    from sqlalchemy import text

    from app.core.database import engine

    checks: list[dict] = []
    with engine.connect() as connection:
        dialect = connection.dialect.name
        checks.append({"name": "dialect", "status": "pass" if dialect == "postgresql" else "fail", "dialect": dialect})
        if dialect != "postgresql":
            return checks

        vector_extension = connection.execute(text("SELECT extname FROM pg_extension WHERE extname='vector'")).scalar()
        checks.append({"name": "vector_extension", "status": "pass" if vector_extension == "vector" else "fail"})

        vector_column = connection.execute(
            text(
                """
                SELECT format_type(a.atttypid, a.atttypmod)
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                WHERE c.relname = 'document_chunks'
                  AND a.attname = 'embedding_vector'
                  AND NOT a.attisdropped
                """
            )
        ).scalar()
        checks.append({"name": "embedding_vector_column", "status": "pass" if vector_column == "vector(1024)" else "fail", "type": vector_column})

        index_name = connection.execute(
            text("SELECT indexname FROM pg_indexes WHERE tablename='document_chunks' AND indexname='ix_document_chunks_embedding_vector_hnsw'")
        ).scalar()
        checks.append({"name": "hnsw_index", "status": "pass" if index_name else "fail", "index": index_name})

        distance = connection.execute(text("SELECT embedding_vector <=> embedding_vector FROM document_chunks WHERE embedding_vector IS NOT NULL LIMIT 1")).scalar()
        checks.append({"name": "vector_distance", "status": "pass" if distance == 0 else "fail", "distance": distance})

        active_chunks = connection.execute(
            text(
                """
                SELECT COUNT(*)
                FROM document_chunks dc
                JOIN sourcedocument sd ON sd.id = dc.document_id
                WHERE dc.is_active = true
                  AND sd.status = 'approved'
                """
            )
        ).scalar_one()
        checks.append(
            {
                "name": "active_approved_chunks",
                "status": "pass" if active_chunks >= min_active_chunks else "fail",
                "count": active_chunks,
                "minimum": min_active_chunks,
            }
        )
    return checks


def main() -> int:
    args = parse_args()
    try:
        checks = docker_checks(args.min_active_chunks) if args.docker_compose else sqlalchemy_checks(args.min_active_chunks)
    except Exception as exc:
        result = {
            "status": "fail",
            "checks": [],
            "error": str(exc),
            "guidance": "If localhost:5432 is occupied by another PostgreSQL service, use --docker-compose or stop the conflicting service.",
        }
        print(json.dumps(result, indent=2) if args.json else result)
        return 1

    failed = [check for check in checks if check["status"] == "fail"]
    result = {"status": "fail" if failed else "pass", "checks": checks}
    print(json.dumps(result, indent=2) if args.json else result)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
