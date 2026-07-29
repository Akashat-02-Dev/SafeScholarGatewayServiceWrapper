import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import export
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO)
settings = get_settings()

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

# Restrict CORS to internal gateway calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["POST"],
)

app.include_router(export.router, prefix="/v1/lms")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "lms-integration"}
