from langdetect import detect, LangDetectException
from app.core.config import get_settings
from app.services.llm import ModelUnavailableError, get_llm_provider

SUPPORTED_LANGUAGES = [
    {"code": "en", "nativeName": "English", "englishName": "English"},
    {"code": "ko", "nativeName": "한국어", "englishName": "Korean"},
    {"code": "hi", "nativeName": "हिन्दी", "englishName": "Hindi"},
    {"code": "bn", "nativeName": "বাংলা", "englishName": "Bangla"},
    {"code": "vi", "nativeName": "Tiếng Việt", "englishName": "Vietnamese"},
    {"code": "th", "nativeName": "ไทย", "englishName": "Thai"},
    {"code": "zh", "nativeName": "中文", "englishName": "Chinese"},
    {"code": "ja", "nativeName": "日本語", "englishName": "Japanese"},
    {"code": "ru", "nativeName": "Русский", "englishName": "Russian"},
    {"code": "mn", "nativeName": "Монгол", "englishName": "Mongolian"},
    {"code": "es", "nativeName": "Español", "englishName": "Spanish"},
    {"code": "fr", "nativeName": "Français", "englishName": "French"},
    {"code": "ms", "nativeName": "Bahasa Melayu", "englishName": "Malay"},
    {"code": "ta", "nativeName": "தமிழ்", "englishName": "Tamil"},
]

SUPPORTED_LANGUAGE_CODES = {language["code"] for language in SUPPORTED_LANGUAGES}

LANGUAGE_ALIASES = {
    "zh-cn": "zh",
    "zh-tw": "zh",
    "zh-hans": "zh",
    "zh-hant": "zh",
    "cn": "zh",
    "kr": "ko",
    "jp": "ja",
}


def normalize_language_code(language: str | None, fallback: str = "en") -> str:
    code = (language or "").strip().lower().replace("_", "-")
    code = LANGUAGE_ALIASES.get(code, code.split("-")[0] if code else "")
    return code if code in SUPPORTED_LANGUAGE_CODES else fallback


def language_display_name(language: str | None) -> str:
    normalized = normalize_language_code(language)
    for entry in SUPPORTED_LANGUAGES:
        if entry["code"] == normalized:
            return entry["englishName"]
    return "English"


def _detect_by_script(text: str) -> str | None:
    def has_range(low: int, high: int) -> bool:
        return any(low <= ord(char) <= high for char in text)

    # Order matters: check distinctive scripts first, and check Japanese kana
    # before CJK ideographs so kanji-leading Japanese is not misread as Chinese.
    if has_range(0xAC00, 0xD7AF):
        return "ko"
    if has_range(0x3040, 0x30FF):  # hiragana / katakana -> Japanese
        return "ja"
    if has_range(0x0E00, 0x0E7F):
        return "th"
    if has_range(0x0900, 0x097F):
        return "hi"
    if has_range(0x0980, 0x09FF):
        return "bn"
    if has_range(0x0B80, 0x0BFF):
        return "ta"
    if has_range(0x1800, 0x18AF):
        return "mn"
    if has_range(0x4E00, 0x9FFF):  # CJK ideographs (no kana) -> Chinese
        return "zh"
    return None


def detect_language(text: str, fallback: str = "en") -> str:
    fallback = normalize_language_code(fallback)
    stripped = text.strip()
    if not stripped:
        return fallback
    script_language = _detect_by_script(stripped)
    if script_language:
        return script_language
    try:
        detected = detect(stripped)
    except LangDetectException:
        return fallback
    return normalize_language_code(detected, fallback)


async def rewrite_queries(query: str, language: str) -> list[str]:
    language = normalize_language_code(language)
    if language in {"en", "ko"}:
        return [query]
    settings = get_settings()
    if settings.demo_mode or settings.app_env.lower() == "test":
        return [query, f"{query} English University", f"{query} Korean University", f"{query} 대학교"]
    provider = get_llm_provider()
    system = (
        "Rewrite the user's university question for retrieval. Return exactly two lines: "
        "line 1 in English, line 2 in Korean. Do not answer the question."
    )
    user = f"Question language: {language}\nQuestion: {query}"
    rewritten = await provider.chat(system, user)
    lines = [line.strip("- ").strip() for line in rewritten.splitlines() if line.strip()]
    return [query, *lines[:2]]


async def translate_text(text: str, target_language: str) -> str:
    target_language = normalize_language_code(target_language)
    if target_language == "en" or not text.strip():
        return text
    settings = get_settings()
    if settings.demo_mode or settings.app_env.lower() == "test":
        return f"[{target_language}] {text}"
    provider = get_llm_provider()
    system = (
        f"Translate the text into {language_display_name(target_language)} (language code {target_language}). "
        f"Use simple student-friendly language. Preserve official names, URLs, and citations. "
        f"Return only the translation."
    )
    try:
        return await provider.chat(system, text)
    except ModelUnavailableError:
        raise
    except Exception as exc:
        raise ModelUnavailableError("Translation is unavailable because the local model provider is not reachable.") from exc


def translate_stub(text: str, target_language: str) -> str:
    target_language = normalize_language_code(target_language)
    return text if target_language == "en" else f"[{target_language}] {text}"
