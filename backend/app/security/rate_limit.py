from collections import defaultdict, deque
from collections.abc import Callable
from time import monotonic

from fastapi import HTTPException, Request, status


_WINDOWS_SECONDS = {
    "second": 1,
    "minute": 60,
    "hour": 3600,
    "day": 86400,
}

_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def _parse_limit(limit: str) -> tuple[int, int]:
    count_text, _, window_text = limit.strip().partition("/")
    count = int(count_text)
    window = _WINDOWS_SECONDS.get(window_text.rstrip("s").lower())
    if count < 1 or window is None:
        raise ValueError(f"Unsupported rate limit: {limit}")
    return count, window


def route_rate_limit(limit: str) -> Callable[[Request], None]:
    max_requests, window_seconds = _parse_limit(limit)

    def dependency(request: Request) -> None:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        client_host = forwarded_for.split(",", 1)[0].strip()
        if not client_host and request.client:
            client_host = request.client.host
        key = f"{request.url.path}:{client_host or 'unknown'}"
        now = monotonic()
        bucket = _BUCKETS[key]
        while bucket and now - bucket[0] >= window_seconds:
            bucket.popleft()
        if len(bucket) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
            )
        bucket.append(now)

    return dependency
