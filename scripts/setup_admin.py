import argparse
import os
import sys
from pathlib import Path

import sqlalchemy as sa
from sqlmodel import Session

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend"))

from app.core.database import create_db_and_tables, engine
from app.models.tables import AdminUser
from app.security.auth import ADMIN_ROLES, get_admin_user_by_email, hash_password, validate_admin_password_strength


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or update the initial admin/reviewer account.")
    parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL"), help="Admin email. Defaults to ADMIN_EMAIL.")
    parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD"), help="Admin password. Defaults to ADMIN_PASSWORD.")
    parser.add_argument("--role", default=os.getenv("ADMIN_ROLE", "admin"), choices=sorted(ADMIN_ROLES), help="Admin role.")
    return parser.parse_args()


def ensure_local_tables() -> None:
    if engine.dialect.name == "sqlite":
        create_db_and_tables()


def main() -> int:
    args = parse_args()
    email = (args.email or "").strip().lower()
    password = args.password or ""
    role = args.role

    if not email:
        print("ADMIN_EMAIL or --email is required.", file=sys.stderr)
        return 2
    if not password:
        print("ADMIN_PASSWORD or --password is required.", file=sys.stderr)
        return 2

    try:
        validate_admin_password_strength(password, email)
    except ValueError as exc:
        print(f"Refusing weak admin password: {exc}", file=sys.stderr)
        return 2

    ensure_local_tables()
    with Session(engine) as session:
        user = get_admin_user_by_email(session, email)
        action = "updated"
        if user is None:
            user = AdminUser(email=email, hashed_password=hash_password(password), role=role, is_active=True)
            action = "created"
        else:
            user.hashed_password = hash_password(password)
            user.role = role
            user.is_active = True
        session.add(user)
        try:
            session.commit()
        except sa.exc.IntegrityError as exc:
            session.rollback()
            print(f"Could not save admin user: {exc}", file=sys.stderr)
            return 1

    print(f"Admin user {action}: {email} ({role})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
