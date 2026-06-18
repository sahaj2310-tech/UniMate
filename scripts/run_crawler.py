import argparse
import asyncio
import sys
from pathlib import Path
from sqlmodel import Session, select

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend"))

from app.core.database import engine
from app.models.tables import CrawlLog, DocumentChunk, SourceDocument
from app.scraper.allowlist import SEED_URLS
from app.scraper.crawler import crawl_seed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crawl approved sources into the UniMate knowledge base.")
    seed_group = parser.add_mutually_exclusive_group()
    seed_group.add_argument("--seed-url", help="Crawl one allowlisted seed URL.")
    seed_group.add_argument("--all-seeds", action="store_true", help="Crawl every configured seed URL. This is the default.")
    parser.add_argument("--page-limit", type=int, default=20, help="Maximum pages to crawl per seed. Default: 20.")
    parser.add_argument(
        "--approve-after-crawl",
        action="store_true",
        help="Local demo helper only: approve all pending crawled documents and activate chunks after the crawl.",
    )
    return parser.parse_args()


def summarize(session: Session) -> dict:
    documents = session.exec(select(SourceDocument)).all()
    chunks = session.exec(select(DocumentChunk)).all()
    logs = session.exec(select(CrawlLog)).all()
    log_counts: dict[str, int] = {}
    for log in logs:
        key = log.message.splitlines()[0]
        log_counts[key] = log_counts.get(key, 0) + 1
    return {
        "documents": len(documents),
        "pending_documents": sum(1 for document in documents if document.status == "pending"),
        "approved_documents": sum(1 for document in documents if document.status == "approved"),
        "rejected_documents": sum(1 for document in documents if document.status == "rejected"),
        "chunks": len(chunks),
        "active_chunks": sum(1 for chunk in chunks if chunk.is_active),
        "embedding_models": sorted({f"{chunk.embedding_provider}/{chunk.embedding_model}/{chunk.embedding_dimension}" for chunk in chunks}),
        "crawl_log_messages": dict(sorted(log_counts.items(), key=lambda item: item[0])[:20]),
    }


def approve_pending_for_demo(session: Session) -> dict:
    pending_documents = session.exec(select(SourceDocument).where(SourceDocument.status == "pending")).all()
    activated_chunks = 0
    for document in pending_documents:
        document.status = "approved"
        session.add(document)
        chunks = session.exec(select(DocumentChunk).where(DocumentChunk.document_id == document.id)).all()
        for chunk in chunks:
            if not chunk.is_active:
                chunk.is_active = True
                activated_chunks += 1
            session.add(chunk)
    session.commit()
    return {"approved_documents": len(pending_documents), "activated_chunks": activated_chunks}


async def main() -> None:
    args = parse_args()
    if args.page_limit < 1 or args.page_limit > 500:
        raise SystemExit("--page-limit must be between 1 and 500")
    seed_urls = [args.seed_url] if args.seed_url else SEED_URLS
    with Session(engine) as session:
        print({"before": summarize(session)})
        for url in seed_urls:
            print(f"Crawling {url} with page_limit={args.page_limit}", flush=True)
            await crawl_seed(session, url, page_limit=args.page_limit)
        if args.approve_after_crawl:
            print({"demo_approval": approve_pending_for_demo(session)})
        print({"after": summarize(session)})


if __name__ == "__main__":
    asyncio.run(main())
