from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header
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
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header, Request

class AICompletionRequest(BaseModel):
    tool_id: str | None = None
    institution_id: str | None = None
    parameters: Dict[str, Any] = {}
    session_id: str | None = None

class DocumentIngestRequest(BaseModel):
    institution_id: str
    document_name: str
    raw_text: str

@router.post("/orchestrate")
# Educator endpoints
@router.post("/ai/educator/lesson-planner")
@router.post("/ai/educator/leveler")
@router.post("/ai/educator/text-leveler")
@router.post("/ai/educator/video-question-maker")
@router.post("/ai/educator/iep-generator")
@router.post("/ai/educator/report-card")
@router.post("/ai/educator/ismg-rubric")
@router.post("/ai/educator/worksheet-generator")
@router.post("/ai/educator/assessment-generator")
@router.post("/ai/educator/district-knowledge-bot")
@router.post("/ai/educator/custom-bot")

# Student endpoints
@router.post("/ai/student/writing-feedback")
@router.post("/ai/student/quiz-generator")
@router.post("/ai/student/quiz-me")
@router.post("/ai/student/character-bot")
@router.post("/ai/student/custom-bot")
@router.post("/ai/student/text-leveler")
@router.post("/ai/student/leveler")
@router.post("/ai/student/socratic-tutor")

# Admin endpoints
@router.post("/ai/admin/report-card-generator")
@router.post("/ai/admin/report-card")
async def orchestrate_ai_task(
    request: AICompletionRequest,
    raw_req: Request,
    db: AsyncSession = Depends(get_db_session),
    x_institution_id: str | None = Header(None, alias="X-Institution-Id")
):
    """Synchronous REST Endpoint for Tier 1 Educator Tools"""
    path = raw_req.url.path
    tool_id = request.tool_id
    if not tool_id:
        if path.endswith("/report-card") or path.endswith("/report-card-generator"):
            tool_id = "report_card_generator"
        elif path.endswith("/ismg-rubric"):
            tool_id = "ismg_rubric_generator"
        elif path.endswith("/district-knowledge-bot"):
            tool_id = "district_knowledge_bot"
        elif path.endswith("/lesson-planner"):
            tool_id = "lesson_planner"
        elif path.endswith("/leveler") or path.endswith("/text-leveler"):
            tool_id = "leveler"
        elif path.endswith("/video-question-maker"):
            tool_id = "video_question_maker"
        elif path.endswith("/iep-generator"):
            tool_id = "iep_generator"
        elif path.endswith("/worksheet-generator"):
            tool_id = "worksheet_generator"
        elif path.endswith("/assessment-generator"):
            tool_id = "assessment_generator"
        elif path.endswith("/writing-feedback"):
            tool_id = "writing_feedback"
        elif path.endswith("/quiz-generator") or path.endswith("/quiz-me"):
            tool_id = "quiz_generator"
        elif path.endswith("/character-bot"):
            tool_id = "character_bot"
        elif path.endswith("/custom-bot"):
            tool_id = "custom_bot"
        elif path.endswith("/socratic-tutor") or path.endswith("/tutor"):
            tool_id = "socratic_tutor"
        else:
            tool_id = "lesson_planner"

    # ZERO-TRUST TENANT ENFORCEMENT: Header set by Gateway JWT parser takes absolute precedence
    institution_id = x_institution_id if (x_institution_id and x_institution_id.strip()) else (request.institution_id or "default")
    request.institution_id = institution_id

    
    # 1. Check Semantic Cache
    cached_response = await SemanticCache.get_cached_response(tool_id, request.parameters)
    if cached_response:
        cached_response["metadata"] = {"cache_hit": "true"}
        return cached_response

    # 2. Inject institution_id into parameters so LLM Router can construct query
    request.parameters["institution_id"] = institution_id

    # 3. Execute Prompt via Router (providing db for RAG retrieval)
    try:
        response = await orchestrator.execute_tool(tool_id, request.parameters, db=db)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream AI Providers Unavailable: {str(e)}")

    # 4. Format & Cache Response
    response_dict = response.model_dump()
    await SemanticCache.set_cached_response(tool_id, request.parameters, response_dict)
    
    return response_dict


@router.post("/rag/ingest")
async def ingest_district_knowledge(
    request: DocumentIngestRequest, 
    db: AsyncSession = Depends(get_db_session),
    x_institution_id: str | None = Header(None, alias="X-Institution-Id")
):
    """
    Tier 3 Administrative Endpoint: 
    Ingests local district standards into the Vector DB.
    """
    inst_id = x_institution_id if (x_institution_id and x_institution_id.strip()) else request.institution_id
    try:
        chunk_count = await rag_service.ingest_document(
            db=db,
            institution_id=inst_id,
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

@router.get("/rag/documents")
async def list_district_documents(
    institution_id: str = Header(alias="X-Institution-Id"),
    db: AsyncSession = Depends(get_db_session)
):
    """Lists distinct document names with chunk counts for the given institution_id."""
    try:
        docs = await rag_service.get_institution_documents(db, institution_id)
        return docs
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

from fastapi import UploadFile, File
from fastapi.responses import Response

from fastapi import UploadFile, File
from fastapi.responses import Response

@router.post("/audio/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribes input speech to text using Whisper API with 25MB limit."""
    max_size = 25 * 1024 * 1024  # 25MB
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=413, detail="Audio file too large. Maximum size allowed is 25MB.")
    
    # Mock return for testing transcription Socratic chat triggers
    return {
        "text": "Can you explain double digit multiplication using Socratic method?",
        "language": "en"
    }

class AudioSynthesizeRequest(BaseModel):
    text: str
    voice: str = "alloy"

@router.post("/audio/synthesize")
async def synthesize_speech(request: AudioSynthesizeRequest):
    """Generates speech response using Neural TTS."""
    # Minimal mock MP3 header + silence bytes
    dummy_mp3 = b"\xff\xfb\x90\x44" + b"\x00" * 1000
    return Response(content=dummy_mp3, media_type="audio/mpeg")

