from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "SafeScholar LMS Integration Service"
    VERSION: str = "1.0.0"
    
    # Canvas LMS Configurations
    CANVAS_BASE_URL: str = "https://canvas.instructure.com/api/v1"
    CANVAS_CLIENT_ID: str = ""
    CANVAS_CLIENT_SECRET: str = ""
    
    # Google Classroom Configurations
    GOOGLE_CLASSROOM_API_URL: str = "https://classroom.googleapis.com/v1"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    
    # HTTP Client Timeout
    HTTP_TIMEOUT: int = 10

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

@lru_cache
def get_settings() -> Settings:
    return Settings()
