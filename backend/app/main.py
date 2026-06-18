from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from sqlmodel import Session, select
from app.api.routes import router
from app.core.config import get_settings
from app.core.database import create_db_and_tables, engine
from app.models.tables import LanguageSetting, Notice, OfficeContact
from app.multilingual.languages import SUPPORTED_LANGUAGES
from app.services.office_router import OFFICES

settings = get_settings()
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.api_rate_limit])


def seed_database() -> None:
    if engine.dialect.name == "sqlite":
        create_db_and_tables()
    with Session(engine) as session:
        if not session.exec(select(LanguageSetting)).first():
            for language in SUPPORTED_LANGUAGES:
                session.add(
                    LanguageSetting(
                        code=language["code"],
                        native_name=language["nativeName"],
                        english_name=language["englishName"],
                    )
                )
        if not session.exec(select(OfficeContact)).first():
            for office in OFFICES:
                session.add(
                    OfficeContact(
                        name=office.name,
                        purpose=office.purpose,
                        email=office.email,
                        phone=office.phone,
                        location=office.location,
                        source_url=office.source_url,
                    )
                )
        if not session.exec(select(Notice)).first():
            for title, category, date, description in [
                ("System Maintenance", "Alert", "2026-05-25", "Smart Campus may be unavailable during maintenance."),
                ("Scholarship Applications Open", "Announcement", "2026-05-24", "Check eligibility and official deadlines."),
                ("Tuition Payment Reminder", "Deadline", "2026-05-23", "Verify payment instructions on the official notice."),
                ("Career Fair 2026", "Announcement", "2026-05-21", "Career support event for students."),
                ("Library Schedule Change", "Alert", "2026-05-20", "Library hours may change during exam period."),
            ]:
                session.add(Notice(title=title, category=category, date=date, description=description))
        session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_database()
    yield


app = FastAPI(
    title="UniMate API",
    description="Verified multilingual university AI assistant backend with RAG, crawler, and admin review.",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
