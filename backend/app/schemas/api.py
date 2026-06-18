import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.multilingual.languages import normalize_language_code
from app.security.policy import minimize_user_text


LANGUAGE_MAX_LENGTH = 24
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_optional_language(value: str | None) -> str | None:
    if value is None:
        return None
    if len(value) > LANGUAGE_MAX_LENGTH:
        raise ValueError("Language code is too long")
    return normalize_language_code(value)


def _normalize_required_language(value: str) -> str:
    if len(value) > LANGUAGE_MAX_LENGTH:
        raise ValueError("Language code is too long")
    return normalize_language_code(value)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    language: str | None = None
    session_id: int | None = None

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str | None) -> str | None:
        return _normalize_optional_language(value)


class Citation(BaseModel):
    title: str
    url: str
    last_updated: str | None = None


class ChatResponse(BaseModel):
    answer: str
    confidence: str
    citations: list[Citation]
    related_pages: list[Citation] = Field(default_factory=list)
    suggested_next_actions: list[str]
    requires_handoff: bool
    routed_office: str | None = None
    language: str


class BulkApprovalRequest(BaseModel):
    document_ids: list[int] = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)


class BulkApprovalResponse(BaseModel):
    status: str
    requested_count: int
    approved_count: int
    already_approved_count: int
    not_found_count: int
    chunks_activated_count: int
    approved_document_ids: list[int]
    already_approved_document_ids: list[int]
    not_found_document_ids: list[int]


class SourceMetadataResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None
    url: str
    title: str
    source_type: str
    language: str
    last_crawled_at: datetime
    published_at: datetime | None = None


class AdminSourceResponse(SourceMetadataResponse):
    raw_hash: str
    raw_text: str
    status: str


class SourceDocumentCreate(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    title: str = Field(min_length=1, max_length=300)
    raw_text: str = Field(min_length=1, max_length=500_000)
    source_type: str = Field(default="web", min_length=1, max_length=80)
    language: str = "en"
    published_at: datetime | None = None

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        return _normalize_required_language(value)

    @field_validator("url", "title", "source_type")
    @classmethod
    def strip_strings(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Value cannot be blank")
        return stripped


class AdminFaqRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    answer: str = Field(min_length=1, max_length=4000)
    language: str = "en"
    source_url: str | None = Field(default=None, max_length=2048)
    requires_handoff: bool = False
    tags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        return _normalize_required_language(value)

    @field_validator("question", "answer")
    @classmethod
    def redact_text(cls, value: str) -> str:
        redacted = minimize_user_text(value, max_length=4000).strip()
        if not redacted:
            raise ValueError("Value cannot be blank")
        return redacted

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[Any]) -> list[str]:
        tags: list[str] = []
        for tag in value:
            cleaned = str(tag).strip().lower()[:40]
            if cleaned and cleaned not in tags:
                tags.append(cleaned)
        return tags


class RetrieveRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    language: str | None = None
    top_k: int = Field(default=5, ge=1, le=20)

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str | None) -> str | None:
        return _normalize_optional_language(value)


class FeedbackRequest(BaseModel):
    message_id: int | None = None
    helpful: bool
    reasons: list[str] = Field(default_factory=list, max_length=10)
    comment: str | None = Field(default=None, max_length=1000)

    @field_validator("reasons")
    @classmethod
    def validate_reasons(cls, value: list[str]) -> list[str]:
        return [reason.strip()[:120] for reason in value if reason.strip()]

    @field_validator("comment")
    @classmethod
    def redact_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        redacted = minimize_user_text(value, max_length=1000).strip()
        return redacted or None


class HandoffRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    language: str = "en"
    user_email: str | None = Field(default=None, max_length=254)
    office_name: str | None = Field(default=None, max_length=120)

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        return _normalize_required_language(value)

    @field_validator("user_email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        email = value.strip()
        if not EMAIL_RE.match(email):
            raise ValueError("Invalid email address")
        return email


class ChecklistRequest(BaseModel):
    audience: str = Field(min_length=1, max_length=80)
    language: str = "en"

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        return _normalize_required_language(value)


class NoticeExplainerRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    language: str = "en"

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        return _normalize_required_language(value)


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    source_language: str | None = None
    target_language: str

    @field_validator("source_language")
    @classmethod
    def validate_source_language(cls, value: str | None) -> str | None:
        return _normalize_optional_language(value)

    @field_validator("target_language")
    @classmethod
    def validate_target_language(cls, value: str) -> str:
        return _normalize_required_language(value)


class CrawlRequest(BaseModel):
    seed_url: str = Field(min_length=1, max_length=2048)
    page_limit: int = Field(default=40, ge=1, le=200)


class AdminLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not EMAIL_RE.match(email):
            raise ValueError("Invalid email address")
        return email


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class AdminMeResponse(BaseModel):
    email: str
    role: str
    is_active: bool
