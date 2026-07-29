// src/types/aios.ts

export type AIToolID = 
  | 'socratic_tutor' 
  | 'lesson_planner' 
  | 'leveler' 
  | 'video_question_maker' 
  | 'iep_generator';

export interface AICompletionRequest<T = Record<string, unknown>> {
  tool_id: AIToolID;
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
