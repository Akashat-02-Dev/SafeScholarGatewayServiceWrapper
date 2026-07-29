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
  }
};
