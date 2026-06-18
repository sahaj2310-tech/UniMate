import json
from hashlib import sha256
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from app.analytics.metrics import admin_analytics
from app.core.database import get_session
from app.models.tables import (
    AnalyticsEvent,
    ApprovalStatus,
    AdminUser,
    DocumentChunk,
    ChecklistTemplate,
    FaqEntry,
    FailedQuery,
    Feedback,
    HandoffTicket,
    Notice,
    OfficeContact,
    SourceApproval,
    SourceDocument,
)
from app.multilingual.languages import SUPPORTED_LANGUAGES, normalize_language_code, translate_text
from app.rag.pipeline import answer_question
from app.rag.retriever import retrieve
from app.schemas.api import (
    AdminLoginRequest,
    AdminMeResponse,
    AdminFaqRequest,
    AdminSourceResponse,
    AdminTokenResponse,
    BulkApprovalRequest,
    BulkApprovalResponse,
    ChatRequest,
    ChecklistRequest,
    CrawlRequest,
    FeedbackRequest,
    HandoffRequest,
    NoticeExplainerRequest,
    RetrieveRequest,
    SourceDocumentCreate,
    SourceMetadataResponse,
    TranslateRequest,
)
from app.scraper.crawler import crawl_seed
from app.security.auth import authenticate_admin_user, create_access_token, require_admin_user, require_roles
from app.security.policy import minimize_email, minimize_user_text, sanitize_source_text
from app.security.rate_limit import route_rate_limit
from app.services.office_router import OFFICES, route_office
from app.services.llm import ModelUnavailableError

router = APIRouter(prefix="/api")
admin_only = require_roles("admin")
reviewer_or_admin = require_roles("admin", "reviewer")


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "unimate"}


@router.get("/languages")
def languages() -> list[dict]:
    return SUPPORTED_LANGUAGES


@router.post("/chat", dependencies=[Depends(route_rate_limit("40/minute"))])
async def chat(payload: ChatRequest, session: Session = Depends(get_session)):
    try:
        response = await answer_question(session, payload.message, payload.language)
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    session.add(AnalyticsEvent(event_type="chat", language=response.language, category=response.routed_office))
    if response.requires_handoff:
        session.add(FailedQuery(query=minimize_user_text(payload.message), language=response.language, routed_office=response.routed_office))
    else:
        session.add(AnalyticsEvent(event_type="verified_answer", language=response.language))
    session.commit()
    return response


@router.post("/chat/stream", dependencies=[Depends(route_rate_limit("20/minute"))])
async def chat_stream(payload: ChatRequest, session: Session = Depends(get_session)):
    try:
        response = await answer_question(session, payload.message, payload.language)
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    async def generate():
        for token in response.answer.split():
            yield f"data: {json.dumps({'token': token + ' '})}\n\n"
        yield f"data: {json.dumps({'done': True, 'response': response.model_dump()})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/retrieve", dependencies=[Depends(route_rate_limit("60/minute"))])
async def retrieve_endpoint(payload: RetrieveRequest, session: Session = Depends(get_session)):
    try:
        chunks = await retrieve(session, payload.query, payload.language or "en", payload.top_k)
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"chunks": [chunk.__dict__ for chunk in chunks]}


@router.post("/feedback", dependencies=[Depends(route_rate_limit("30/minute"))])
def feedback(payload: FeedbackRequest, session: Session = Depends(get_session)):
    item = Feedback(
        message_id=payload.message_id,
        helpful=payload.helpful,
        reasons_json=json.dumps(payload.reasons),
        comment=payload.comment,
    )
    session.add(item)
    session.add(AnalyticsEvent(event_type="feedback", metadata_json=json.dumps({"helpful": payload.helpful})))
    session.commit()
    return {"status": "received"}


@router.post("/report-answer", dependencies=[Depends(route_rate_limit("30/minute"))])
def report_answer(payload: FeedbackRequest, session: Session = Depends(get_session)):
    payload.helpful = False
    return feedback(payload, session)


@router.get("/sources", response_model=list[SourceMetadataResponse])
def sources(session: Session = Depends(get_session)):
    rows = session.exec(select(SourceDocument).where(SourceDocument.status == ApprovalStatus.approved)).all()
    return rows


@router.get("/notices")
def notices(session: Session = Depends(get_session)):
    rows = session.exec(select(Notice)).all()
    if rows:
        return rows
    return [
        {"title": "System Maintenance", "category": "Alert", "date": "2026-05-25", "description": "Smart Campus maintenance window."},
        {"title": "Scholarship Applications Open", "category": "Announcement", "date": "2026-05-24", "description": "Review official scholarship notice."},
        {"title": "Tuition Payment Reminder", "category": "Deadline", "date": "2026-05-23", "description": "Verify payment details with official notice."},
    ]


@router.get("/offices")
def offices(session: Session = Depends(get_session)):
    rows = session.exec(select(OfficeContact)).all()
    if rows:
        return rows
    return [office.__dict__ for office in OFFICES]


@router.post("/translate")
async def translate(payload: TranslateRequest):
    try:
        translated = await translate_text(payload.text, payload.target_language)
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"translated_text": translated, "target_language": payload.target_language}


@router.post("/notice-explainer")
async def notice_explainer(payload: NoticeExplainerRequest):
    sanitized_content = minimize_user_text(sanitize_source_text(payload.content), max_length=1200)
    lowered = sanitized_content.lower()
    action_items = ["Open original source", "Contact relevant office if unclear"]
    if any(keyword in lowered for keyword in ["deadline", "due", "until", "by ", "마감", "까지"]):
        action_items.insert(0, "Check deadline")
    if any(keyword in lowered for keyword in ["document", "certificate", "form", "서류", "증명서"]):
        action_items.append("Prepare required documents")
    if any(keyword in lowered for keyword in ["fee", "payment", "tuition", "등록금", "납부"]):
        action_items.append("Verify payment instructions")
    try:
        summary_seed = (
            "This notice may require action. Check dates, office, documents, and official links before proceeding. "
            f"Notice excerpt: {sanitized_content[:500]}"
        )
        summary = await translate_text(summary_seed, payload.language)
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "summary": summary,
        "action_required": list(dict.fromkeys(action_items)),
        "language": payload.language,
    }


@router.post("/checklist")
def checklist(payload: ChecklistRequest, session: Session = Depends(get_session)):
    saved_template = session.exec(
        select(ChecklistTemplate).where(ChecklistTemplate.audience == payload.audience, ChecklistTemplate.language == payload.language)
    ).first()
    if saved_template:
        return {"title": saved_template.title, "items": json.loads(saved_template.items_json)}
    templates = {
        "new_student": ["Confirm admission", "Prepare visa documents", "Book airport route", "Check dormitory", "Prepare ARC appointment"],
        "exchange_student": ["Confirm exchange dates", "Check course registration", "Prepare insurance", "Join orientation"],
        "visa_extension": ["Check expiry date", "Collect enrollment certificate", "Prepare housing proof", "Book immigration appointment"],
        "scholarship": ["Check eligibility", "Confirm deadline", "Prepare transcript", "Submit official application", "Save confirmation receipt"],
        "tuition_payment": ["Check invoice", "Confirm bank/payment method", "Pay before deadline", "Keep receipt", "Contact finance office if unclear"],
    }
    audience = payload.audience.strip().lower()
    return {"title": f"{audience.replace('_', ' ').title()} Checklist", "items": templates.get(audience, templates["new_student"])}


@router.post("/handoff-ticket", dependencies=[Depends(route_rate_limit("20/minute"))])
def handoff(payload: HandoffRequest, session: Session = Depends(get_session)):
    office = payload.office_name or route_office(payload.question).name
    ticket = HandoffTicket(
        question=minimize_user_text(payload.question),
        language=payload.language,
        user_email=minimize_email(payload.user_email),
        office_name=office,
    )
    session.add(ticket)
    session.add(AnalyticsEvent(event_type="handoff", language=payload.language, category=office))
    session.commit()
    session.refresh(ticket)
    return ticket


@router.post("/admin/login", response_model=AdminTokenResponse, dependencies=[Depends(route_rate_limit("10/minute"))])
def admin_login(payload: AdminLoginRequest, session: Session = Depends(get_session)):
    user = authenticate_admin_user(session, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return AdminTokenResponse(access_token=create_access_token(user.email, user.role), role=user.role)


@router.get("/admin/me", response_model=AdminMeResponse)
def admin_me(user: AdminUser = Depends(require_admin_user)):
    return AdminMeResponse(email=user.email, role=user.role, is_active=user.is_active)


@router.get("/admin/sources", response_model=list[AdminSourceResponse], dependencies=[Depends(reviewer_or_admin)])
def admin_sources_full(session: Session = Depends(get_session)):
    return session.exec(select(SourceDocument).order_by(SourceDocument.last_crawled_at.desc())).all()


@router.post("/admin/sources", response_model=AdminSourceResponse, dependencies=[Depends(admin_only)])
def admin_sources(document: SourceDocumentCreate, session: Session = Depends(get_session)):
    sanitized_text = sanitize_source_text(document.raw_text)
    if not sanitized_text:
        raise HTTPException(status_code=422, detail="Source text is empty after sanitization")
    stored_document = SourceDocument(
        url=document.url,
        title=document.title,
        source_type=document.source_type,
        language=normalize_language_code(document.language),
        raw_hash=sha256(sanitized_text.encode("utf-8")).hexdigest(),
        raw_text=sanitized_text,
        status=ApprovalStatus.pending,
        published_at=document.published_at,
    )
    session.add(stored_document)
    session.commit()
    session.refresh(stored_document)
    return stored_document


@router.post("/admin/crawl", dependencies=[Depends(admin_only), Depends(route_rate_limit("6/minute"))])
async def admin_crawl(payload: CrawlRequest, session: Session = Depends(get_session)):
    job = await crawl_seed(session, payload.seed_url, payload.page_limit)
    return job


@router.get("/admin/crawl-logs", dependencies=[Depends(reviewer_or_admin)])
def crawl_logs(session: Session = Depends(get_session)):
    from app.models.tables import CrawlLog

    return session.exec(select(CrawlLog).order_by(CrawlLog.created_at.desc()).limit(100)).all()


@router.get("/admin/analytics", dependencies=[Depends(reviewer_or_admin)])
def analytics(session: Session = Depends(get_session)):
    return admin_analytics(session)


@router.get("/admin/failed-queries", dependencies=[Depends(reviewer_or_admin)])
def failed_queries(session: Session = Depends(get_session)):
    return session.exec(select(FailedQuery).order_by(FailedQuery.created_at.desc()).limit(100)).all()


@router.post("/admin/approve-document")
def approve_document(document_id: int, session: Session = Depends(get_session), user: AdminUser = Depends(reviewer_or_admin)):
    document = session.get(SourceDocument, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    document.status = ApprovalStatus.approved
    chunks = session.exec(select(DocumentChunk).where(DocumentChunk.document_id == document_id)).all()
    for chunk in chunks:
        chunk.is_active = True
        session.add(chunk)
    session.add(document)
    session.add(SourceApproval(document_id=document_id, status=ApprovalStatus.approved, reviewer_id=user.id))
    session.commit()
    return {"status": "approved", "document_id": document_id}


@router.post("/admin/approve-documents", response_model=BulkApprovalResponse)
def approve_documents(
    payload: BulkApprovalRequest,
    admin: AdminUser = Depends(reviewer_or_admin),
    session: Session = Depends(get_session),
):
    requested_ids = list(dict.fromkeys(payload.document_ids))
    documents = session.exec(select(SourceDocument).where(SourceDocument.id.in_(requested_ids))).all()
    documents_by_id = {document.id: document for document in documents if document.id is not None}
    reviewer_id = admin.id

    approved_ids: list[int] = []
    already_approved_ids: list[int] = []
    not_found_ids: list[int] = []
    chunks_activated_count = 0

    for document_id in requested_ids:
        document = documents_by_id.get(document_id)
        if document is None:
            not_found_ids.append(document_id)
            continue

        was_approved = document.status == ApprovalStatus.approved
        if was_approved:
            already_approved_ids.append(document_id)
        else:
            document.status = ApprovalStatus.approved
            approved_ids.append(document_id)

        chunks = session.exec(select(DocumentChunk).where(DocumentChunk.document_id == document_id)).all()
        for chunk in chunks:
            if not chunk.is_active:
                chunks_activated_count += 1
            chunk.is_active = True
            session.add(chunk)

        session.add(document)
        session.add(
            SourceApproval(
                document_id=document_id,
                status=ApprovalStatus.approved,
                reviewer_id=reviewer_id,
                notes=payload.notes,
            )
        )

    session.commit()
    return BulkApprovalResponse(
        status="approved",
        requested_count=len(requested_ids),
        approved_count=len(approved_ids),
        already_approved_count=len(already_approved_ids),
        not_found_count=len(not_found_ids),
        chunks_activated_count=chunks_activated_count,
        approved_document_ids=approved_ids,
        already_approved_document_ids=already_approved_ids,
        not_found_document_ids=not_found_ids,
    )


@router.post("/admin/reject-document")
def reject_document(document_id: int, session: Session = Depends(get_session), user: AdminUser = Depends(reviewer_or_admin)):
    document = session.get(SourceDocument, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    document.status = ApprovalStatus.rejected
    chunks = session.exec(select(DocumentChunk).where(DocumentChunk.document_id == document_id)).all()
    for chunk in chunks:
        chunk.is_active = False
        session.add(chunk)
    session.add(document)
    session.add(SourceApproval(document_id=document_id, status=ApprovalStatus.rejected, reviewer_id=user.id))
    session.commit()
    return {"status": "rejected", "document_id": document_id}


@router.post("/admin/faq", dependencies=[Depends(admin_only)])
def admin_faq(payload: AdminFaqRequest, session: Session = Depends(get_session)):
    entry = FaqEntry(
        question=payload.question,
        answer=payload.answer,
        language=payload.language,
        source_url=payload.source_url,
        requires_handoff=payload.requires_handoff,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {
        "status": "queued_for_review",
        "faq": {
            "id": entry.id,
            "question": entry.question,
            "answer": entry.answer,
            "language": entry.language,
            "source_url": entry.source_url,
            "requires_handoff": entry.requires_handoff,
            "tags": payload.tags,
        },
    }
