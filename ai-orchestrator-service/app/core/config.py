from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "SafeScholar AI Orchestrator"
    VERSION: str = "1.0.0"
    
    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Database Configuration
    DATABASE_URL: str = "postgresql+asyncpg://safescholar:safescholar@localhost:5432/safescholar"
    DB_USER: str = "safescholar"
    DB_PASSWORD: str = ""
    DB_HOST: str = ""
    DB_PORT: str = "5432"
    DB_NAME: str = "safescholar"

    @property
    def get_database_url(self) -> str:
        if self.DB_HOST and self.DB_PASSWORD:
            import urllib.parse
            user = urllib.parse.quote_plus(self.DB_USER)
            pwd = urllib.parse.quote_plus(self.DB_PASSWORD)
            return f"postgresql+asyncpg://{user}:{pwd}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        return self.DATABASE_URL
    
    # Enterprise LLM API Keys (Zero-Retention Enforced via Provider Orgs)
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    
    # Circuit Breaker / Timeout Settings
    LLM_TIMEOUT_SECONDS: int = 15
    MAX_RETRIES: int = 2

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

@lru_cache
def get_settings() -> Settings:
    return Settings()
