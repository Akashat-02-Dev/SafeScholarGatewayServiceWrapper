import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.models.vector_models import KnowledgeChunk
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class RAGPipeline:
    def __init__(self):
        self.embeddings = GoogleGenerativeAIEmbeddings(
            google_api_key=settings.GOOGLE_API_KEY, 
            model="text-embedding-004"
        )
        # Optimized chunking for pedagogical standards and legalistic text
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=150,
            separators=["\n\n", "\n", ".", " ", ""]
        )

    async def ingest_document(self, db: AsyncSession, institution_id: str, document_name: str, raw_text: str):
        """Chunks a document, embeds it, and upserts to pgvector."""
        logger.info(f"Starting ingestion for {document_name} (Institution: {institution_id})")
        
        # 1. Chunk the text
        chunks = self.text_splitter.split_text(raw_text)
        
        # 2. Generate embeddings in bulk
        vector_embeddings = await self.embeddings.aembed_documents(chunks)
        
        # 3. Save to database
        db_chunks = []
        for i, chunk_text in enumerate(chunks):
            new_chunk = KnowledgeChunk(
                institution_id=institution_id,
                document_name=document_name,
                content=chunk_text,
                embedding=vector_embeddings[i],
                metadata_json={"chunk_index": i}
            )
            db_chunks.append(new_chunk)
            db.add(new_chunk)
            
        await db.commit()
        logger.info(f"Successfully ingested {len(chunks)} chunks into vector database.")
        return len(chunks)

    async def retrieve_context(self, db: AsyncSession, institution_id: str, query: str, top_k: int = 3) -> str:
        """Embeds the user query and performs a similarity search restricted by institution."""
        # 1. Embed the search query
        query_vector = await self.embeddings.aembed_query(query)
        
        # 2. Query pgvector using Cosine Distance (<=>), filtered by institution_id
        stmt = (
            select(KnowledgeChunk)
            .filter(KnowledgeChunk.institution_id == institution_id)
            .order_by(KnowledgeChunk.embedding.cosine_distance(query_vector))
            .limit(top_k)
        )
        
        result = await db.execute(stmt)
        top_chunks = result.scalars().all()
        
        # 3. Combine chunks into a single context string for the LLM prompt
        combined_context = "\n\n---\n\n".join([chunk.content for chunk in top_chunks])
        return combined_context

rag_service = RAGPipeline()
