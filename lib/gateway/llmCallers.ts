/**
 * Thin wrapper functions that call each supported AI provider's chat-completion
 * endpoint and return raw text.  Each function receives an already-resolved
 * API key so keys never leak into logs.
 *
 * Only one function is active per request (chosen by providerRouter), but all
 * are exported so the gateway can support multi-provider failover in future.
 */

import type { AIProvider } from '../types/gateway';

export interface LLMCallParams {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

async function callOpenAI(params: LLMCallParams): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      max_tokens: params.maxTokens,
      temperature: params.temperature ?? 0.7,
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function callAnthropic(params: LLMCallParams): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userPrompt }],
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${body}`);
  }

  const json = await res.json();
  return json.content?.[0]?.text ?? '';
}

// ---------------------------------------------------------------------------
// Google Gemini
// ---------------------------------------------------------------------------

async function callGemini(params: LLMCallParams): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.systemPrompt }] },
      contents: [{ parts: [{ text: params.userPrompt }] }],
      generationConfig: {
        maxOutputTokens: params.maxTokens,
        temperature: params.temperature ?? 0.7,
      },
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini error ${res.status}: ${body}`);
  }

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const CALLERS: Record<AIProvider, (p: LLMCallParams) => Promise<string>> = {
  openai: callOpenAI,
  anthropic: callAnthropic,
  gemini: callGemini,
  cohere: callOpenAI, // placeholder — Cohere support TBD
};

export async function callLLM(
  provider: AIProvider,
  params: LLMCallParams,
): Promise<string> {
  const caller = CALLERS[provider];
  if (!caller) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
  return caller(params);
}
