from urllib.parse import urlparse

ALLOWED_DOMAINS = {
    "www.unimate.example.edu",
    "intl.unimate.example.edu",
    "dorm.unimate.example.edu",
    "wkli.unimate.example.edu",
}

EXCLUDED_PATH_KEYWORDS = {
    "logout",
    "login",
    "admin",
    "member",
    "private",
}

SEED_URLS = [
    "https://www.unimate.example.edu/main/index.jsp",
    "https://www.unimate.example.edu/page/index.jsp?code=eng0206",
    "https://www.unimate.example.edu/page/index.jsp?code=eng0302",
    "https://www.unimate.example.edu/page/index.jsp?code=eng040403a",
    "https://www.unimate.example.edu/page/index.jsp?code=eng050101a",
    "https://intl.unimate.example.edu/proc/engforeign_event.jsp",
    "https://dorm.unimate.example.edu/main/",
    "https://wkli.unimate.example.edu/",
]


def is_allowed_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False
    hostname = (parsed.hostname or "").lower()
    if hostname not in ALLOWED_DOMAINS:
        return False
    lowered_path = parsed.path.lower()
    return not any(keyword in lowered_path for keyword in EXCLUDED_PATH_KEYWORDS)
