import re
import unicodedata


SENSITIVE_KEYWORDS = {
    "visa",
    "immigration",
    "arc",
    "alien registration",
    "scholarship",
    "tuition",
    "tuition fee",
    "payment",
    "graduation",
    "probation",
    "medical",
    "health",
    "mental",
    "legal",
    "emergency",
    "disciplinary",
    "dormitory penalty",
    "work permission",
    "part-time work",
    "insurance",
    "attendance",
    "academic warning",
    "dismissal",
    "expulsion",
    "transcript",
    "grade appeal",
    "gpa",
    "leave of absence",
    "reinstatement",
    "refund",
    "bank account",
    "passport",
    "student id",
    "residence card",
    "sexual harassment",
    "harassment",
    "violence",
    "police",
    "suicide",
    "self harm",
    "self-harm",
    "비자",
    "출입국",
    "외국인등록",
    "외국인 등록",
    "체류",
    "체류허가",
    "장학금",
    "등록금",
    "환불",
    "졸업",
    "학사경고",
    "제적",
    "휴학",
    "복학",
    "성적",
    "성적 이의",
    "징계",
    "기숙사",
    "보험",
    "여권",
    "학생증",
    "성희롱",
    "폭력",
    "자살",
    "tư cách lưu trú",
    "visa du học",
    "học bổng",
    "học phí",
    "bảo hiểm",
    "kỷ luật",
    "졸업",
    "签证",
    "居留",
    "奖学金",
    "学费",
    "毕业",
    "处分",
    "入管",
    "在留",
    "奨学金",
    "授業料",
    "卒業",
    "懲戒",
    "виза",
    "стипендия",
    "оплата обучения",
    "общежитие",
    "виз",
    "тэтгэлэг",
    "сургалтын төлбөр",
    "дотуур байр",
    "वीजा",
    "छात्रवृत्ति",
    "ट्यूशन",
    "ভিসা",
    "স্কলারশিপ",
    "টিউশন",
}

PROMPT_INJECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bignore\s+(all\s+)?(previous|prior|above)\s+instructions?\b",
        r"\b(disregard|override)\s+(all\s+)?(previous|prior|above|system|developer)\s+instructions?\b",
        r"\bforget\s+(all\s+)?(previous|prior|above|system|developer)\s+instructions?\b",
        r"\bignore\s+(the\s+)?(safety|security|citation|source)\s+(policy|rules?)\b",
        r"\b(reveal|print|show|repeat|dump)\s+(your\s+)?(system|developer)\s+(prompt|message|instructions?)\b",
        r"\b(system|developer)\s+(prompt|message|instructions?)\b",
        r"\bact\s+as\s+(?:dan|an?\s+unfiltered|an?\s+uncensored)\b",
        r"\b(exfiltrate|leak|steal)\b",
        r"\b(api[_\s-]?key|secret[_\s-]?key|access[_\s-]?token|jwt_secret|password|credential)\b",
        r"\b(invent|fabricate|make\s+up)\s+(a\s+)?(policy|rule|source|citation|url|deadline)\b",
        r"\bdo\s+not\s+cite\s+sources?\b",
        r"\banswer\s+without\s+(sources?|citations?|verification)\b",
        r"\btrust\s+this\s+(document|page|source)\s+over\s+(system|developer|policy)\b",
        r"\bcopy\s+the\s+hidden\s+(prompt|instructions?)\b",
        r"\bjailbreak\b",
        r"(?i)(이전|위의)\s*(지시|명령|프롬프트)\s*(무시|잊어)",
        r"(?i)(시스템|개발자)\s*(프롬프트|지시|메시지)\s*(공개|출력|반복)",
        r"(?i)(来源|引用|规则|政策).*(编造|伪造)",
        r"(?i)(指示|命令).*(無視|忘れ)",
    ]
]

FALLBACK_ANSWER = "I could not verify this from the available UNIMATE University sources. Please contact the relevant office."
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE_RE = re.compile(r"(?:\+?\d[\d .()-]{7,}\d)")
STUDENT_ID_RE = re.compile(r"\b\d{7,12}\b")


def _normalize_for_policy(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    return re.sub(r"\s+", " ", normalized).strip().lower()


def is_sensitive_topic(text: str) -> bool:
    lowered = _normalize_for_policy(text)
    return any(keyword in lowered for keyword in SENSITIVE_KEYWORDS)


def contains_prompt_injection(text: str) -> bool:
    normalized = _normalize_for_policy(text)
    return any(pattern.search(normalized) for pattern in PROMPT_INJECTION_PATTERNS)


def sanitize_source_text(text: str) -> str:
    text = text.replace("\x00", "")
    lines = []
    for line in text.splitlines():
        if contains_prompt_injection(line):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def minimize_user_text(text: str, max_length: int = 500) -> str:
    """Redact common personal identifiers before analytics/ticket persistence."""
    redacted = unicodedata.normalize("NFKC", text).replace("\x00", "")
    redacted = EMAIL_RE.sub("[redacted-email]", redacted)
    redacted = PHONE_RE.sub("[redacted-phone]", redacted)
    redacted = STUDENT_ID_RE.sub("[redacted-id]", redacted)
    return redacted[:max_length]


def minimize_email(email: str | None) -> str | None:
    if not email:
        return None
    return "[redacted-email]"
