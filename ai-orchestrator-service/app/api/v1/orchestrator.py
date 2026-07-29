from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.llm_router import LLMOrchestrator
from app.services.semantic_cache import SemanticCache
from app.services.rag_pipeline import rag_service

router = APIRouter()
orchestrator = LLMOrchestrator()

# --- Contracts matching the Go Gateway ---
class AICompletionRequest(BaseModel):
    tool_id: str
    institution_id: str
    parameters: Dict[str, Any]
    session_id: str | None = None

class DocumentIngestRequest(BaseModel):
    institution_id: str
    document_name: str
    raw_text: str

@router.post("/orchestrate")
@router.post("/ai/educator/lesson-planner")
@router.post("/ai/educator/leveler")
@router.post("/ai/educator/video-question-maker")
@router.post("/ai/educator/iep-generator")
async def orchestrate_ai_task(
    request: AICompletionRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Synchronous REST Endpoint for Tier 1 Educator Tools"""
    
    # 1. Check Semantic Cache
    cached_response = await SemanticCache.get_cached_response(request.tool_id, request.parameters)
    if cached_response:
        cached_response["metadata"] = {"cache_hit": "true"}
        return cached_response

    # 2. Inject institution_id into parameters so LLM Router can construct query
    request.parameters["institution_id"] = request.institution_id

    # 3. Execute Prompt via Router (providing db for RAG retrieval)
    try:
        response = await orchestrator.execute_tool(request.tool_id, request.parameters, db=db)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream AI Providers Unavailable: {str(e)}")

    # 4. Format & Cache Response
    response_dict = response.model_dump()
    await SemanticCache.set_cached_response(request.tool_id, request.parameters, response_dict)
    
    return response_dict

@router.post("/rag/ingest")
async def ingest_district_knowledge(
    request: DocumentIngestRequest, 
    db: AsyncSession = Depends(get_db_session)
):
    """
    Tier 3 Administrative Endpoint: 
    Ingests local district standards into the Vector DB.
    """
    try:
        chunk_count = await rag_service.ingest_document(
            db=db,
            institution_id=request.institution_id,
            document_name=request.document_name,
            raw_text=request.raw_text
        )
        return {
            "status": "success", 
            "message": "Document ingested successfully.",
            "chunks_created": chunk_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws/tutor")
async def websocket_socratic_tutor(websocket: WebSocket, session_id: str):
    """Stateful WebSocket Endpoint for Tier 2 Student Sandbox"""
    await websocket.accept()
    
    try:
        while True:
            # 1. Receive JSON prompt from Go Gateway
            data = await websocket.receive_text()
            
            # 2. In a full production system, we would load rolling chat history 
            # from Redis here using the session_id to maintain conversational context.
            
            parameters = {"user_prompt": data}
            
            # 3. Execute via LLM (In production, use streaming capabilities of Langchain)
            response = await orchestrator.execute_tool("socratic_tutor", parameters)
            
            # 4. Stream response back to Gateway
            await websocket.send_text(response.response_text)
            
    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected.")
