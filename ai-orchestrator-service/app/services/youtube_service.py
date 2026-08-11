import asyncio
from fastapi import HTTPException
from langchain_community.document_loaders import YoutubeLoader

class YouTubeService:
    @staticmethod
    async def fetch_transcript(url: str) -> str:
        """
        Asynchronously fetches and parses YouTube transcripts using LangChain's native loader.
        Offloads the synchronous load() method to a background thread to prevent FastAPI event loop deadlocks.
        """
        try:
            # YoutubeLoader natively extracts the video ID and handles the API handshakes
            loader = YoutubeLoader.from_youtube_url(
                url, 
                add_video_info=False, # Set False to avoid requiring the fragile 'pytube' dependency
                language=["en", "en-US", "es", "fr"] # Fallback language support
            )
            
            # The load() method is blocking. We must wrap it in to_thread.
            docs = await asyncio.to_thread(loader.load)
            
            if not docs:
                raise ValueError("Transcript is empty or unavailable for this video.")
                
            # Combine the chunked LangChain Document objects into a single context string
            transcript_text = " ".join([doc.page_content for doc in docs])
            return transcript_text
            
        except Exception as e:
            # Catch disabled subtitles, private videos, or invalid URLs gracefully
            raise HTTPException(
                status_code=400, 
                detail=f"Unable to parse closed captions. The video may not have subtitles enabled. Error: {str(e)}"
            )
