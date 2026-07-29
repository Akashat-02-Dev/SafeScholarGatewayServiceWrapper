from app.models.schemas import QuizSchema, QuestionSchema

class CanvasAdapter:
    """Transforms SafeScholar schemas to Canvas LMS API representations."""
    
    @staticmethod
    def transform_quiz(quiz: QuizSchema) -> dict:
        return {
            "quiz": {
                "title": quiz.title,
                "description": quiz.description,
                "quiz_type": "assignment",
                "published": False, # Teachers should review before publishing
                "time_limit": 30,
                "shuffle_answers": True
            }
        }
        
    @staticmethod
    def transform_question(question: QuestionSchema, quiz_id: int) -> dict:
        canvas_answers = []
        for idx, option in enumerate(question.options):
            canvas_answers.append({
                "answer_text": option,
                "answer_weight": 100 if idx == question.correct_answer_index else 0
            })
            
        return {
            "question": {
                "question_name": "AI Generated Question",
                "question_text": question.question_text,
                "question_type": "multiple_choice_question" if len(question.options) > 2 else "true_false_question",
                "points_possible": question.points,
                "answers": canvas_answers
            }
        }

class GoogleClassroomAdapter:
    """Transforms SafeScholar schemas to Google Classroom API representations."""
    @staticmethod
    def transform_assignment(quiz: QuizSchema) -> dict:
        # Note: Google Forms API is typically used alongside Classroom for quizzes
        return {
            "courseId": quiz.course_id,
            "title": quiz.title,
            "description": quiz.description,
            "workType": "ASSIGNMENT",
            "state": "DRAFT"
        }
