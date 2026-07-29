from sqlalchemy import Column, String, Text, DateTime, func, JSON
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from app.core.database import Base
import uuid

class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id = Column(String, index=True, nullable=False) # Multi-tenant boundary
    document_name = Column(String, nullable=False)
    
    # The actual text chunk and its vector representation
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536), nullable=False) # OpenAI text-embedding-3-small dimension
    
    # Metadata for tracing (e.g., page numbers, standard codes)
    metadata_json = Column(JSON, default={})
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
