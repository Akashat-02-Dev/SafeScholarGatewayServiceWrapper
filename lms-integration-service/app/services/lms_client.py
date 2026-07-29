import httpx
import logging
from tenacity import retry, stop_after_attempt, wait_exponential
from app.core.config import get_settings
from app.services.adapters import CanvasAdapter
from app.models.schemas import QuizSchema

settings = get_settings()
logger = logging.getLogger(__name__)

class LMSIntegrationClient:
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT)

    async def get_user_oauth_token(self, user_id: str, provider: str) -> str:
        """
        In production, this queries your PostgreSQL database (oauth_accounts table)
        or a secure Redis vault to fetch the decrypted OAuth access token for the user.
        """
        # Mocked for architectural demonstration
        return "mock_oauth_access_token_123"

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def export_to_canvas(self, user_id: str, quiz: QuizSchema) -> dict:
        token = await self.get_user_oauth_token(user_id, "canvas")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # 1. Transform and Create the Shell Quiz
        quiz_payload = CanvasAdapter.transform_quiz(quiz)
        quiz_url = f"{settings.CANVAS_BASE_URL}/courses/{quiz.course_id}/quizzes"
        
        quiz_resp = await self.http_client.post(quiz_url, json=quiz_payload, headers=headers)
        quiz_resp.raise_for_status()
        canvas_quiz_id = quiz_resp.json().get("id")

        # 2. Iterate and Push Questions to the newly created Canvas Quiz
        for q in quiz.questions:
            q_payload = CanvasAdapter.transform_question(q, canvas_quiz_id)
            q_url = f"{quiz_url}/{canvas_quiz_id}/questions"
            
            q_resp = await self.http_client.post(q_url, json=q_payload, headers=headers)
            q_resp.raise_for_status()

        logger.info(f"Successfully exported quiz {canvas_quiz_id} to Canvas for User {user_id}")
        return {"status": "success", "external_id": canvas_quiz_id, "platform": "canvas"}
