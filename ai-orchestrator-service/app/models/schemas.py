from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from uuid import UUID

class CustomBotCreateRequest(BaseModel):
    institution_id: str
    teacher_id: str
    name: str
    system_prompt: str
    source_document_ids: Optional[List[str]] = Field(default_factory=list)
    allowed_topics: Optional[List[str]] = Field(default_factory=list)
    strictness_level: Optional[int] = 5

class CustomBotResponse(BaseModel):
    bot_id: UUID
    institution_id: UUID
    teacher_id: UUID
    name: str
    system_prompt: str
    source_document_ids: List[str]
    allowed_topics: List[str]
    strictness_level: int
    created_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True
