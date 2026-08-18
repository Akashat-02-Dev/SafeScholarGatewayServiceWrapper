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

class VideoQuestionSchema(BaseModel):
    timestamp: str
    question: str
    options: List[str]
    answer: str
    explanation: str

class LessonPhaseSchema(BaseModel):
    phase_name: str
    duration_minutes: int
    teacher_actions: str
    student_actions: str
    differentiation_notes: dict

class LessonPlanSchema(BaseModel):
    lesson_title: str
    grade_level: str
    duration_minutes: int
    aligned_standards: List[dict]
    essential_questions: List[str]
    learning_objectives: List[str]
    materials_required: List[str]
    instructional_phases: List[LessonPhaseSchema]
    formative_assessment: dict

class IEPCriteriaSchema(BaseModel):
    name: str
    novice: str
    developing: str
    proficient: str
    exemplary: str

class IEPRubricSchema(BaseModel):
    title: str
    nccd_level_of_adjustment: str
    criteria: List[IEPCriteriaSchema]

class FeedbackPoint(BaseModel):
    category: str
    comment: str

class WritingFeedbackSchema(BaseModel):
    feedback_points: List[FeedbackPoint]

class QuizQuestionSchema(BaseModel):
    question: str
    options: List[str]
    answer: str
    explanation: str

class QuizGeneratorSchema(BaseModel):
    title: str
    questions: List[QuizQuestionSchema]

class ReportCardSchema(BaseModel):
    student_name: str
    grade_assigned: str
    report_comment: str

class ISMGPerformanceLevelSchema(BaseModel):
    mark_range: str
    description: str

class ISMGCriterionSchema(BaseModel):
    criterion_name: str
    performance_levels: List[ISMGPerformanceLevelSchema]

class ISMGRubricSchema(BaseModel):
    assessment_title: str
    instrument_type: str
    ismg_criteria: List[ISMGCriterionSchema]
