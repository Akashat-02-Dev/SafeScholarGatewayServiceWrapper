import json
from redis.asyncio import Redis
from app.core.config import get_settings
from langchain_google_genai import GoogleGenerativeAIEmbeddings

settings = get_settings()
redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
embeddings = GoogleGenerativeAIEmbeddings(google_api_key=settings.GOOGLE_API_KEY, model="text-embedding-004")

class SemanticCache:
    SIMILARITY_THRESHOLD = 0.98  # Very strict threshold for educational accuracy
    
    @staticmethod
    async def get_cached_response(tool_id: str, prompt_params: dict) -> dict | None:
        """Checks Redis for a semantically identical previous generation."""
        # 1. Flatten params to a single string for embedding
        content_string = json.dumps(prompt_params, sort_keys=True)
        
        # 2. Generate lightweight embedding vector
        query_vector = await embeddings.aembed_query(content_string)
        
        # 3. In production, use Redis FT.SEARCH (RediSearch). 
        # For simplicity here, we check exact parameter hash matches as a baseline cache.
        param_hash = hash(content_string)
        cache_key = f"semantic_cache:{tool_id}:{param_hash}"
        
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        return None

    @staticmethod
    async def set_cached_response(tool_id: str, prompt_params: dict, response_payload: dict):
        """Stores the successful LLM generation in Redis."""
        content_string = json.dumps(prompt_params, sort_keys=True)
        param_hash = hash(content_string)
        cache_key = f"semantic_cache:{tool_id}:{param_hash}"
        
        # Cache for 24 hours
        await redis_client.setex(cache_key, 86400, json.dumps(response_payload))
