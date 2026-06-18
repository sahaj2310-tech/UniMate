from sqlmodel import Session
from app.multilingual.languages import detect_language, language_display_name
from app.rag.retriever import RetrievedChunk, retrieve
from app.schemas.api import ChatResponse, Citation
from app.security.policy import FALLBACK_ANSWER, contains_prompt_injection, is_sensitive_topic
from app.services.office_router import route_office
from app.services.llm import DeterministicFallbackProvider, ModelUnavailableError, get_llm_provider


def classify_intent(question: str) -> str:
    lowered = question.lower()
    if "attendance" in lowered:
        return "attendance"
    if "grade" in lowered:
        return "grades"
    if "scholarship" in lowered:
        return "scholarship"
    if "visa" in lowered or "arc" in lowered:
        return "visa"
    if "dorm" in lowered or "housing" in lowered:
        return "housing"
    return "general"


def enough_sources(chunks: list[RetrievedChunk], sensitive: bool) -> bool:
    threshold = 0.42 if sensitive else 0.28
    return bool(chunks) and chunks[0].score >= threshold


async def grounded_answer(question: str, chunks: list[RetrievedChunk], language: str) -> str:
    if not chunks:
        return FALLBACK_ANSWER
    return await synthesize_from_sources(question, chunks, language)


def extractive_answer(chunks: list[RetrievedChunk], model_unavailable: bool = False) -> str:
    source_lines = "\n".join(f"- {chunk.text[:500].strip()}" for chunk in chunks[:3])
    prefix = ""
    if model_unavailable:
        prefix = (
            "Local answer model is unavailable, so this answer quotes only retrieved official source excerpts.\n\n"
        )
    return (
        f"{prefix}"
        "Based on the available sources, here is the verified guidance:\n\n"
        f"{source_lines}\n\n"
        "Please open the cited source link for the latest official details before making a decision."
    )


async def synthesize_from_sources(question: str, chunks: list[RetrievedChunk], language: str = "en") -> str:
    provider = get_llm_provider()
    if isinstance(provider, DeterministicFallbackProvider):
        return extractive_answer(chunks)

    language_name = language_display_name(language)
    system = (
        "You answer student questions using only the provided source excerpts. "
        "Do not use outside knowledge. Do not invent policies, dates, contacts, URLs, or requirements. "
        "If the excerpts do not contain the answer, say that the available sources do not verify it and "
        "recommend checking the cited official source or contacting the relevant office. Keep the answer concise. "
        f"Write the entire answer in {language_name}, even when the source excerpts are in another language. "
        "Keep official names, URLs, and citations unchanged."
    )
    source_text = "\n\n".join(
        f"Source {index}: {chunk.title}\nURL: {chunk.url}\nExcerpt: {chunk.text[:1200].strip()}"
        for index, chunk in enumerate(chunks[:3], start=1)
    )
    user = f"Question: {question}\n\nSources:\n{source_text}"
    try:
        answer = (await provider.chat(system, user)).strip()
    except ModelUnavailableError:
        return extractive_answer(chunks, model_unavailable=True)

    if not answer:
        return extractive_answer(chunks)
    return answer


async def answer_question(session: Session, question: str, language: str | None = None) -> ChatResponse:
    selected_language = language or detect_language(question)
    if contains_prompt_injection(question):
        office = route_office(question)
        return ChatResponse(
            answer=FALLBACK_ANSWER,
            confidence="low",
            citations=[],
            suggested_next_actions=["Contact the relevant office", "Search official notices"],
            requires_handoff=True,
            routed_office=office.name,
            language=selected_language,
        )

    intent = classify_intent(question)
    sensitive = is_sensitive_topic(question)
    chunks = await retrieve(session, question, selected_language)
    if not enough_sources(chunks, sensitive):
        office = route_office(question)
        return ChatResponse(
            answer=FALLBACK_ANSWER,
            confidence="low",
            citations=[Citation(title=office.name, url=office.source_url or "https://www.unimate.example.edu/main/index.jsp")],
            suggested_next_actions=["Search official notices", "Show related pages", f"Contact {office.name}"],
            requires_handoff=True,
            routed_office=office.name,
            language=selected_language,
        )

    citations = [
        Citation(title=chunk.title, url=chunk.url, last_updated=chunk.last_updated)
        for chunk in chunks[:3]
    ]
    confidence = "high" if chunks[0].score > 0.68 and not sensitive else "medium"
    return ChatResponse(
        answer=await grounded_answer(question, chunks, selected_language),
        confidence=confidence,
        citations=citations,
        related_pages=citations[1:],
        suggested_next_actions=[
            "View original source",
            "Save this answer",
            "Ask a follow-up question",
            "Contact the office" if sensitive else "Open related guide",
        ],
        requires_handoff=confidence == "low",
        routed_office=route_office(question).name if sensitive else None,
        language=selected_language,
    )
