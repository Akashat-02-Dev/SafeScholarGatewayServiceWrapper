// src/types/aios.ts

export type AIToolID = 
  | 'socratic_tutor' 
  | 'lesson_planner' 
  | 'leveler' 
  | 'video_question_maker' 
  | 'iep_generator'
  | 'worksheet_generator'
  | 'assessment_generator'
  | 'ismg_rubric_generator'
  | 'writing_feedback'
  | 'quiz_generator'
  | 'character_bot'
  | 'custom_bot'
  | 'report_card_generator';

export interface AICompletionRequest<T = Record<string, unknown>> {
  tool_id: AIToolID | string;
  institution_id: string;
  parameters: T;
  session_id?: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AICompletionResponse<T = string | Record<string, unknown>> {
  response_text: T;
  model_used: string;
  tokens: TokenUsage;
  metadata?: Record<string, string>;
}

export interface WorksheetQuestion {
  number: number;
  prompt: string;
  type: string;
  options?: string[] | null;
  answer: string;
}

export interface WorksheetExercise {
  section_name: string;
  instructions: string;
  questions: WorksheetQuestion[];
}

export interface WorksheetSchema {
  title: string;
  grade_level: string;
  subject: string;
  learning_focus: string;
  aligned_standards: string[];
  student_instructions: string;
  exercises: WorksheetExercise[];
  differentiation?: {
    support_notes?: string;
    extension_notes?: string;
  };
  teacher_summary?: string;
}

export interface AssessmentQuestion {
  id: string;
  number: number;
  question_text: string;
  question_type: string;
  options?: string[];
  correct_answer: string;
  marks: number;
  explanation: string;
  cognitive_verb?: string;
}

export interface AssessmentSchema {
  test_title: string;
  grade_level: string;
  subject: string;
  assessment_type: string;
  time_limit_minutes: number;
  total_marks: number;
  instructions: string;
  aligned_standards: string[];
  questions: AssessmentQuestion[];
  grading_scale?: Record<string, string>;
}

// Target Schemas for Specific Tools
export interface LessonPlanSchema {
  lesson_title: string;
  grade_level: string;
  duration_minutes: number;
  aligned_standards: Array<{
    code: string;
    description: string;
    bloom_taxonomy_level: string;
  }>;
  essential_questions: string[];
  learning_objectives: string[];
  materials_required: string[];
  instructional_phases: Array<{
    phase_name: string;
    duration_minutes: number;
    teacher_actions: string;
    student_actions: string;
    differentiation_notes: {
      remediation: string;
      on_level: string;
      extension: string;
    };
  }>;
  formative_assessment: {
    method: string;
    rubric_criteria: string[];
  };
}

export interface ChatMessage {
  id: string;
  sender: 'student' | 'ai' | 'system';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface LMSExportPayload {
  user_id: string;
  institution_id: string;
  target_lms: 'canvas' | 'google_classroom';
  payload: Record<string, unknown>;
}
