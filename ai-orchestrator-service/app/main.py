import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import orchestrator, bots
from app.core.config import get_settings

# Configure standard JSON logging for Datadog / ELK
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multi-Model LLM Orchestration layer for SafeScholar"
)

# CORS: In production, strictly lock this down to the internal network IPs of the Go Gateway
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register internal microservice routes
app.include_router(orchestrator.router, prefix="/v1")
app.include_router(bots.router, prefix="/v1/bots", tags=["bots"])

@app.on_event("startup")
async def startup_event():
    """Bootstraps database extensions and tables for vector RAG and Custom Bots."""
    from sqlalchemy import text
    from app.core.database import engine
    from app.models.vector_models import KnowledgeChunk
    from app.models.custom_bot import CustomBotConfig
    
    # 1. Try to create custom_bots table (uses standard columns, always works)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(lambda sync_conn: CustomBotConfig.__table__.create(sync_conn, checkfirst=True))
        logging.info("custom_bots table verified/created successfully.")
    except Exception as err:
        logging.error(f"Failed to create custom_bots table: {err}")

    # 2. Try to create pgvector extension and knowledge_chunks table
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            await conn.run_sync(lambda sync_conn: KnowledgeChunk.__table__.create(sync_conn, checkfirst=True))
        logging.info("knowledge_chunks table verified/created successfully.")
    except Exception as err:
        logging.warning(f"Failed to create knowledge_chunks table (probably missing pgvector): {err}")

@app.get("/health")
async def health_check():
    """Liveness probe for Kubernetes / Service Registry"""
    return {"status": "healthy", "service": "ai-orchestrator"}

if __name__ == "__main__":
    import uvicorn
    # Runs on port 8000 internally. Go Gateway proxies traffic to http://ai-orchestrator:8000/v1/...
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
