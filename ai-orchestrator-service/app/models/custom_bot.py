import uuid
from sqlalchemy import Column, String, Text, DateTime, func, Integer, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class CustomBotConfig(Base):
    __tablename__ = "custom_bots"

    bot_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    teacher_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=False)
    source_document_ids = Column(ARRAY(String), default=[])
    allowed_topics = Column(ARRAY(String), default=[])
    strictness_level = Column(Integer, default=5)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
