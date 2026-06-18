import asyncio
import hashlib
import json
from datetime import datetime
from urllib.parse import urljoin, urldefrag, urlparse
from urllib.robotparser import RobotFileParser
import httpx
from bs4 import BeautifulSoup
from langdetect import detect, LangDetectException
from sqlmodel import Session, delete, select
from app.core.config import get_settings
from app.ingestion.chunker import chunk_text
from app.models.tables import ApprovalStatus, CrawlJob, CrawlLog, DocumentChunk, SourceApproval, SourceDocument
from app.scraper.allowlist import is_allowed_url
from app.security.policy import sanitize_source_text
from app.services.llm import DeterministicFallbackProvider, get_llm_provider

TEXT_CONTENT_TYPES = {
    "text/html",
    "text/plain",
    "application/xhtml+xml",
}

BINARY_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".zip",
    ".hwp",
    ".hwpx",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
}


def normalize_url(url: str) -> str:
    normalized = urldefrag(url)[0]
    parsed = urlparse(normalized)
    # Canonicalize HTTP to HTTPS for known domains
    if parsed.scheme == "http":
        return parsed._replace(scheme="https").geturl()
    return normalized


def is_probably_binary_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return any(path.endswith(extension) for extension in BINARY_EXTENSIONS)


def is_text_response(response: httpx.Response) -> bool:
    content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    return content_type in TEXT_CONTENT_TYPES


def robots_allowed(url: str, user_agent: str) -> bool:
    parsed = httpx.URL(url)
    robots_url = f"{parsed.scheme}://{parsed.host}/robots.txt"
    parser = RobotFileParser()
    parser.set_url(robots_url)
    try:
        parser.read()
    except Exception:
        return True
    return parser.can_fetch(user_agent, url)


def extract_text(html: str) -> tuple[str, str, list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    title = soup.title.get_text(" ", strip=True) if soup.title else "UNIMATE University Source"
    text = sanitize_source_text(soup.get_text(" ", strip=True))
    links = [a.get("href") for a in soup.find_all("a", href=True)]
    return title, text, [link for link in links if link]


async def crawl_seed(session: Session, seed_url: str, page_limit: int) -> CrawlJob:
    settings = get_settings()
    normalized_seed_url = normalize_url(seed_url)
    job = CrawlJob(seed_url=normalized_seed_url, page_limit=page_limit, status="running")
    session.add(job)
    session.commit()
    session.refresh(job)

    provider = get_llm_provider()
    fallback = DeterministicFallbackProvider()
    queue = [normalized_seed_url]
    seen: set[str] = set()

    try:
        async with httpx.AsyncClient(timeout=settings.crawl_request_timeout_seconds, headers={"User-Agent": settings.crawl_user_agent}, follow_redirects=True) as client:
            while queue and len(seen) < min(page_limit, settings.crawl_max_pages):
                url = normalize_url(queue.pop(0))
                if url in seen or not is_allowed_url(url) or not robots_allowed(url, settings.crawl_user_agent):
                    continue
                seen.add(url)
                try:
                    response = await client.get(url)
                    session.add(CrawlLog(job_id=job.id, url=url, status_code=response.status_code, message="fetched"))
                    response.raise_for_status()
                except Exception as exc:
                    session.add(CrawlLog(job_id=job.id, url=url, message=f"failed: {exc}"))
                    session.commit()
                    continue
                if is_probably_binary_url(url) or not is_text_response(response):
                    session.add(CrawlLog(job_id=job.id, url=url, status_code=response.status_code, message="skipped: non-text content"))
                    session.commit()
                    continue

                title, text, links = extract_text(response.text)
                if len(text) < 250:
                    session.add(CrawlLog(job_id=job.id, url=url, status_code=response.status_code, message="skipped: low text"))
                    session.commit()
                    continue
                raw_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
                try:
                    language = detect(text[:1000])
                except LangDetectException:
                    language = "en"
                status = ApprovalStatus.pending if settings.crawl_require_approval else ApprovalStatus.approved
                document = session.exec(select(SourceDocument).where(SourceDocument.url == url)).first()
                if document and document.raw_hash == raw_hash:
                    document.last_crawled_at = datetime.utcnow()
                    session.add(document)
                    session.add(CrawlLog(job_id=job.id, url=url, status_code=response.status_code, message="skipped: unchanged"))
                    session.commit()
                else:
                    if document:
                        document.title = title[:250]
                        document.raw_hash = raw_hash
                        document.raw_text = text
                        document.language = language
                        document.status = status
                        document.last_crawled_at = datetime.utcnow()
                        session.exec(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
                    else:
                        document = SourceDocument(
                            url=url,
                            title=title[:250],
                            raw_hash=raw_hash,
                            raw_text=text,
                            language=language,
                            status=status,
                        )
                    session.add(document)
                    session.commit()
                    session.refresh(document)
                    for index, chunk in enumerate(chunk_text(text)):
                        try:
                            embedding = await provider.embed(chunk)
                        except Exception:
                            if not settings.demo_mode and settings.app_env.lower() != "test":
                                raise
                            embedding = await fallback.embed(chunk)
                        embedding_json = json.dumps(embedding)
                        session.add(
                            DocumentChunk(
                                document_id=document.id,
                                chunk_index=index,
                                text=chunk,
                                token_count=max(1, len(chunk.split())),
                                embedding_vector=embedding_json,
                                embedding_json=embedding_json,
                                embedding_provider=settings.embedding_provider,
                                embedding_model=settings.ollama_embedding_model,
                                embedding_dimension=settings.embedding_dimension,
                                embedding_created_at=datetime.utcnow(),
                                is_active=not settings.crawl_require_approval,
                            )
                        )
                    session.add(SourceApproval(document_id=document.id, status=document.status))
                    session.commit()

                for link in links:
                    next_url = normalize_url(urljoin(url, link))
                    if next_url not in seen and is_allowed_url(next_url) and len(queue) < page_limit:
                        queue.append(next_url)
                await asyncio.sleep(settings.crawl_rate_limit_seconds)
    except Exception as exc:
        session.rollback()
        job = session.get(CrawlJob, job.id) or job
        job.status = "failed"
        job.finished_at = datetime.utcnow()
        session.add(job)
        session.add(CrawlLog(job_id=job.id, url=normalized_seed_url, message=f"crawl failed: {exc}"))
        session.commit()
        session.refresh(job)
        return job

    job.status = "completed"
    job.finished_at = datetime.utcnow()
    session.add(job)
    session.commit()
    session.refresh(job)
    return job
