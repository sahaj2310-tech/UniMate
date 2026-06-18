from datetime import datetime
from enum import Enum
from typing import Optional
import sqlalchemy as sa
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.types import UserDefinedType
from sqlmodel import Field, SQLModel


class Vector1024(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **kw) -> str:
        return "vector(1024)"


@compiles(Vector1024, "sqlite")
def compile_vector_sqlite(type_, compiler, **kw) -> str:
    return "TEXT"


@compiles(Vector1024, "postgresql")
def compile_vector_postgresql(type_, compiler, **kw) -> str:
    return "vector(1024)"


class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: Optional[str] = Field(default=None, index=True)
    preferred_language: str = "en"
    is_anonymous: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AdminUser(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    role: str = "reviewer"
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    title: str = "New chat"
    language: str = "en"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: Optional[int] = Field(default=None, foreign_key="chatsession.id")
    role: str
    content: str
    citations_json: str = "[]"
    confidence: str = "low"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Feedback(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    message_id: Optional[int] = Field(default=None, foreign_key="chatmessage.id")
    helpful: bool
    reasons_json: str = "[]"
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SourceDocument(SQLModel, table=True):
    __table_args__ = (sa.UniqueConstraint("url", name="uq_sourcedocument_url"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    url: str = Field(index=True)
    title: str
    source_type: str = "web"
    language: str = "en"
    raw_hash: str = Field(index=True)
    raw_text: str
    status: ApprovalStatus = ApprovalStatus.pending
    last_crawled_at: datetime = Field(default_factory=datetime.utcnow)
    published_at: Optional[datetime] = None


class DocumentChunk(SQLModel, table=True):
    __tablename__ = "document_chunks"
    __table_args__ = (sa.UniqueConstraint("document_id", "chunk_index", name="uq_documentchunk_document_chunk_index"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="sourcedocument.id")
    chunk_index: int
    text: str
    token_count: int = 0
    is_active: bool = True
    embedding_vector: Optional[str] = Field(default=None, sa_column=sa.Column(Vector1024(), nullable=True))
    embedding_json: str = "[]"
    embedding_provider: str = "ollama"
    embedding_model: str = "bge-m3"
    embedding_dimension: int = 1024
    embedding_created_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CrawlJob(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    seed_url: str
    status: str = "queued"
    page_limit: int = 80
    created_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None


class CrawlLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: Optional[int] = Field(default=None, foreign_key="crawljob.id")
    url: str
    status_code: Optional[int] = None
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FailedQuery(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    query: str
    language: str = "en"
    topic: str = "unknown"
    routed_office: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OfficeContact(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    purpose: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    source_url: Optional[str] = None


class FaqEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    question: str
    answer: str
    language: str = "en"
    source_url: Optional[str] = None
    requires_handoff: bool = False


class LanguageSetting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    native_name: str
    english_name: str
    enabled: bool = True


class AnalyticsEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    event_type: str
    language: str = "en"
    category: Optional[str] = None
    metadata_json: str = "{}"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class HandoffTicket(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_email: Optional[str] = None
    question: str
    language: str = "en"
    office_name: str
    status: str = "open"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChecklistTemplate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    audience: str
    title: str
    items_json: str
    language: str = "en"


class NoticeSummary(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_url: str
    title: str
    summary: str
    language: str = "en"
    action_required: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SavedAnswer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    title: str
    answer: str
    citations_json: str = "[]"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Notice(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    category: str
    date: str
    description: str
    source_url: Optional[str] = None


class SourceApproval(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="sourcedocument.id")
    status: ApprovalStatus = ApprovalStatus.pending
    reviewer_id: Optional[int] = Field(default=None, foreign_key="adminuser.id")
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ResponseCorrection(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    failed_query_id: Optional[int] = Field(default=None, foreign_key="failedquery.id")
    corrected_answer: str
    source_url: str
    language: str = "en"
    approved: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
