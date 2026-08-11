import re
from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

class YouTubeService:
    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        # Matches formats like youtube.com/watch?v=VIDEO_ID, youtu.be/VIDEO_ID, etc.
        pattern = r'(?:v=|\/)([0-9A-Za-z_-]{11}).*'
        match = re.search(pattern, url)
        if match:
            return match.group(1)
        return None

    @staticmethod
    async def fetch_transcript(url: str) -> str:
        video_id = YouTubeService.extract_video_id(url)
        if not video_id:
            raise ValueError(f"Could not extract a valid YouTube video ID from URL: {url}")
        
        try:
            import asyncio
            # Fetch the transcript; offload blocking call to a separate thread
            transcript_list = await asyncio.to_thread(YouTubeTranscriptApi.get_transcript, video_id)
            
            # Format into a contiguous string with timestamps
            formatted_transcript = []
            for item in transcript_list:
                start_time = item['start']
                text = item['text'].replace('\n', ' ')
                # Convert seconds to MM:SS format
                minutes, seconds = divmod(int(start_time), 60)
                timestamp = f"{minutes:02d}:{seconds:02d}"
                formatted_transcript.append(f"[{timestamp}] {text}")
                
            return " ".join(formatted_transcript)
        
        except TranscriptsDisabled:
            raise ValueError(f"Transcripts are disabled for this video: {url}")
        except NoTranscriptFound:
            raise ValueError(f"No transcript found for this video: {url}")
        except Exception as e:
            raise ValueError(f"Failed to fetch transcript: {str(e)}")
