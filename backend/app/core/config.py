from functools import lru_cache
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    frontend_origin: str = "http://localhost:5173"
    cors_origins: str = ""
    database_url: str = "sqlite:///./unimate-dev.db"
    jwt_secret: str = "change-me"
    access_token_expire_minutes: int = 60
    api_rate_limit: str = "120/minute"

    model_provider: str = "ollama"
    embedding_provider: str = "ollama"
    embedding_dimension: int = 1024
    demo_mode: bool = False
    ai_provider: str = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "llama3.2:3b"
    ollama_keep_alive: str = "30m"
    ollama_embedding_model: str = "bge-m3"
    ollama_embed_model: str = "bge-m3"

    crawl_user_agent: str = "UniMate/1.0"
    crawl_max_pages: int = 80
    crawl_request_timeout_seconds: int = 20
    crawl_rate_limit_seconds: float = 2
    crawl_require_approval: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", protected_namespaces=("settings_",))

    @field_validator("frontend_origin")
    @classmethod
    def validate_frontend_origin(cls, value: str) -> str:
        if value == "*":
            raise ValueError("FRONTEND_ORIGIN cannot be '*' when credentials are enabled")
        return value.rstrip("/")

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        if "*" in origins:
            raise ValueError("CORS_ORIGINS cannot include '*' when credentials are enabled")
        return ",".join(origins)

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.embedding_dimension != 1024:
            raise ValueError("EMBEDDING_DIMENSION must be 1024 for the bge-m3 pgvector schema")
        if self.app_env.lower() in {"production", "prod"}:
            weak_secrets = {"change-me", "change-me-use-a-long-random-secret", "secret", "password"}
            if self.jwt_secret in weak_secrets or len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET must be a unique 32+ character secret in production")
            local_origins = ("localhost", "127.0.0.1", "::1")
            if any(origin in self.frontend_origin for origin in local_origins):
                raise ValueError("FRONTEND_ORIGIN must be a deployed HTTPS origin in production")
            if not self.frontend_origin.startswith("https://"):
                raise ValueError("FRONTEND_ORIGIN must use HTTPS in production")
            if any(any(local in origin for local in local_origins) for origin in self.cors_origins.split(",") if origin):
                raise ValueError("CORS_ORIGINS cannot include localhost origins in production")
            if any(not origin.startswith("https://") for origin in self.cors_origins.split(",") if origin):
                raise ValueError("CORS_ORIGINS must use HTTPS in production")
        return self

    @property
    def allowed_cors_origins(self) -> list[str]:
        origins = [self.frontend_origin]
        if self.cors_origins:
            origins.extend(self.cors_origins.split(","))
        if self.app_env.lower() not in {"production", "prod"}:
            origins.extend(["http://localhost:5173", "http://127.0.0.1:5173"])
        return list(dict.fromkeys(origin.rstrip("/") for origin in origins if origin))


@lru_cache
def get_settings() -> Settings:
    return Settings()
