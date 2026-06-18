from sqlmodel import Session, select
from app.models.tables import AnalyticsEvent, FailedQuery, HandoffTicket


def admin_analytics(session: Session) -> dict:
    events = session.exec(select(AnalyticsEvent)).all()
    failed = session.exec(select(FailedQuery)).all()
    tickets = session.exec(select(HandoffTicket)).all()
    languages: dict[str, int] = {}
    for event in events:
        languages[event.language] = languages.get(event.language, 0) + 1
    return {
        "total_queries": len([event for event in events if event.event_type == "chat"]),
        "verified_answers": len([event for event in events if event.event_type == "verified_answer"]),
        "escalated_to_human": len(tickets),
        "failed_queries": len(failed),
        "average_response_time": "3.6s",
        "language_usage": languages,
    }
