from pydantic import BaseModel
from typing import List

class QuestionSchema(BaseModel):
    question_text: str
    question_type: str # e.g., "multiple_choice", "true_false"
    options: List[str]
    correct_answer_index: int
    points: int = 1

class QuizSchema(BaseModel):
    title: str
    description: str
    course_id: str # The external LMS course ID
    questions: List[QuestionSchema]

class ExportRequest(BaseModel):
    user_id: str
    institution_id: str
    target_lms: str # "canvas" or "google_classroom"
    payload: QuizSchema
