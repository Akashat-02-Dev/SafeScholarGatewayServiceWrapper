import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import orchestrator
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

@app.get("/health")
async def health_check():
    """Liveness probe for Kubernetes / Service Registry"""
    return {"status": "healthy", "service": "ai-orchestrator"}

if __name__ == "__main__":
    import uvicorn
    # Runs on port 8000 internally. Go Gateway proxies traffic to http://ai-orchestrator:8000/v1/...
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
