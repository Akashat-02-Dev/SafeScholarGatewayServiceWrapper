from fastapi import APIRouter, HTTPException
from app.models.schemas import ExportRequest
from app.services.lms_client import LMSIntegrationClient

router = APIRouter()
lms_client = LMSIntegrationClient()

@router.post("/export")
async def export_ai_content(request: ExportRequest):
    """
    Accepts AI-generated content and exports it to the requested LMS.
    """
    try:
        if request.target_lms.lower() == "canvas":
            result = await lms_client.export_to_canvas(request.user_id, request.payload)
            return result
            
        elif request.target_lms.lower() == "google_classroom":
            # await lms_client.export_to_google(...)
            return {"status": "success", "message": "Google Export simulated"}
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported target LMS platform")
            
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to communicate with external LMS: {str(e)}")
