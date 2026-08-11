import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db_session
from app.models.custom_bot import CustomBotConfig
from app.models.schemas import CustomBotCreateRequest, CustomBotResponse

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/create", response_model=dict)
async def create_bot(
    req: CustomBotCreateRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Creates a new custom Socratic bot configuration in PostgreSQL."""
    try:
        teacher_uuid = uuid.UUID(req.teacher_id) if isinstance(req.teacher_id, str) else req.teacher_id
        inst_uuid = uuid.UUID(req.institution_id) if isinstance(req.institution_id, str) else req.institution_id
        db_bot = CustomBotConfig(
            institution_id=inst_uuid,
            teacher_id=teacher_uuid,
            name=req.name,
            system_prompt=req.system_prompt,
            source_document_ids=req.source_document_ids or [],
            allowed_topics=req.allowed_topics or [],
            strictness_level=req.strictness_level or 5
        )
        db.add(db_bot)
        await db.commit()
        await db.refresh(db_bot)
        return {"bot_id": str(db_bot.bot_id)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: {e}")
    except Exception as e:
        logger.error(f"Failed to create custom bot: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during bot creation: {str(e)}")

@router.get("/list", response_model=List[CustomBotResponse])
async def list_bots(
    institution_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """Lists custom bots configurations filtered strictly by the given institution_id."""
    try:
        inst_uuid = uuid.UUID(institution_id) if isinstance(institution_id, str) else institution_id
        stmt = select(CustomBotConfig).where(CustomBotConfig.institution_id == inst_uuid).order_by(CustomBotConfig.created_at.desc())
        result = await db.execute(stmt)
        bots = result.scalars().all()
        return bots
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid institution_id UUID format: {e}")
    except Exception as e:
        logger.error(f"Failed to list custom bots: {e}")
        raise HTTPException(status_code=500, detail=f"Database error during bot listing: {str(e)}")
