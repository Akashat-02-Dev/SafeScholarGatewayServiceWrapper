// src/services/aiService.ts
import { apiFetch } from './apiClient';
import type { AICompletionRequest, AICompletionResponse, LessonPlanSchema, LMSExportPayload } from '../types/aios';

function getAccessToken(): string | null {
  const raw = sessionStorage.getItem('safescholar.tokens.v1');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.accessToken || null;
  } catch {
    return null;
  }
}

export const aiService = {
  /**
   * Executes synchronous Educator Workspace tools (Lesson Planner, Leveler, etc.)
   */
  async executeTool<TParams, TReturn>(
    endpoint: string, 
    payload: AICompletionRequest<TParams>
  ): Promise<AICompletionResponse<TReturn>> {
    const token = getAccessToken();
    return apiFetch<AICompletionResponse<TReturn>>(
      `/api/v1/ai/educator/${endpoint}`, 
      {
        method: 'POST',
        body: payload,
        accessToken: token
      }
    );
  },

  /**
   * Specifically handles structured JSON generation for Lesson Plans
   */
  async generateLessonPlan(
    institutionId: string, 
    topic: string, 
    gradeLevel: string, 
    standardCode: string
  ): Promise<LessonPlanSchema> {
    const req: AICompletionRequest<{ topic: string; grade_level: string; standard_code: string }> = {
      tool_id: 'lesson_planner',
      institution_id: institutionId,
      parameters: {
        topic,
        grade_level: gradeLevel,
        standard_code: standardCode,
      },
    };

    const res = await this.executeTool<{ topic: string; grade_level: string; standard_code: string }, string>(
      'lesson-planner', 
      req
    );
    
    // Parse the structured JSON output returned by GPT-4o
    return JSON.parse(res.response_text as string) as LessonPlanSchema;
  },

  /**
   * Triggers cross-platform LMS exports via LTI 1.3 integration bridge
   */
  async exportToLMS(exportData: LMSExportPayload): Promise<{ status: string; external_id: string }> {
    const token = getAccessToken();
    return apiFetch<{ status: string; external_id: string }>(
      '/api/v1/lms/export', 
      {
        method: 'POST',
        body: exportData,
        accessToken: token
      }
    );
  },

  /**
   * Ingests local district standards/curricula into pgvector DB
   */
  async ingestDistrictKnowledge(
    documentName: string, 
    rawText: string, 
    institutionId: string
  ): Promise<{ status: string; message: string; chunks_created: number }> {
    const token = getAccessToken();
    return apiFetch<{ status: string; message: string; chunks_created: number }>(
      '/api/v1/rag/ingest', 
      {
        method: 'POST',
        body: {
          institution_id: institutionId,
          document_name: documentName,
          raw_text: rawText
        },
        accessToken: token
      }
    );
  },

  /**
   * Generates Australian Curriculum Prep to Year 5 Worksheets (Kura Plan / Magic School style)
   */
  async generateWorksheet(
    institutionId: string,
    gradeLevel: string,
    subject: string,
    topic: string,
    userPrompt: string
  ): Promise<any> {
    const req: AICompletionRequest = {
      tool_id: 'worksheet_generator',
      institution_id: institutionId,
      parameters: {
        grade_level: gradeLevel,
        subject,
        topic,
        user_prompt: userPrompt
      }
    };
    const res = await this.executeTool('worksheet-generator', req);
    const parsed = typeof res.response_text === 'string' ? JSON.parse(res.response_text) : res.response_text;
    return parsed;
  },

  /**
   * Generates Australian Assessments, Tests & Quizzes (NAPLAN & Curriculum Aligned)
   */
  async generateAssessment(
    institutionId: string,
    gradeLevel: string,
    subject: string,
    assessmentType: string,
    questionCount: number,
    topic: string,
    userPrompt: string
  ): Promise<any> {
    const req: AICompletionRequest = {
      tool_id: 'assessment_generator',
      institution_id: institutionId,
      parameters: {
        grade_level: gradeLevel,
        subject,
        assessment_type: assessmentType,
        question_count: String(questionCount),
        topic,
        user_prompt: userPrompt
      }
    };
    const res = await this.executeTool('assessment-generator', req);
    const parsed = typeof res.response_text === 'string' ? JSON.parse(res.response_text) : res.response_text;
    return parsed;
  },

  /**
   * Generates Australian ISMG & Standards Rubrics
   */
  async generateRubric(
    institutionId: string,
    subject: string,
    instrumentType: string,
    userPrompt: string
  ): Promise<any> {
    const req: AICompletionRequest = {
      tool_id: 'ismg_rubric_generator',
      institution_id: institutionId,
      parameters: {
        subject,
        instrument_type: instrumentType,
        user_prompt: userPrompt
      }
    };
    const res = await this.executeTool('ismg-rubric', req);
    const parsed = typeof res.response_text === 'string' ? JSON.parse(res.response_text) : res.response_text;
    return parsed;
  },

  /**
   * Adapts text complexity to Australian grade bands (Prep to Year 5)
   */
  async levelText(
    institutionId: string,
    targetGrade: string,
    userPrompt: string
  ): Promise<string> {
    const req: AICompletionRequest = {
      tool_id: 'leveler',
      institution_id: institutionId,
      parameters: {
        target_grade: targetGrade,
        user_prompt: userPrompt
      }
    };
    const res = await this.executeTool('leveler', req);
    return typeof res.response_text === 'string' ? res.response_text : JSON.stringify(res.response_text);
  },

  /**
   * Executes student endpoints
   */
  async executeStudentTool<TParams, TReturn>(
    endpoint: string,
    toolId: string,
    institutionId: string,
    parameters: TParams
  ): Promise<AICompletionResponse<TReturn>> {
    const token = getAccessToken();
    return apiFetch<AICompletionResponse<TReturn>>(
      `/api/v1/ai/student/${endpoint}`,
      {
        method: 'POST',
        body: {
          tool_id: toolId,
          institution_id: institutionId,
          parameters
        },
        accessToken: token
      }
    );
  }
};
