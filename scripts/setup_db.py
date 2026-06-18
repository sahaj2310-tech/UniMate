import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend"))

from app.core.database import create_db_and_tables


if __name__ == "__main__":
    create_db_and_tables()
    print("Database tables are ready.")
