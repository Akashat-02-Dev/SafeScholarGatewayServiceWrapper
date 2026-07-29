import { NextRequest, NextResponse } from 'next/server';

import { callLLM } from '@/lib/gateway/llmCallers';
import { getAIConfig, getProviderApiKey } from '@/lib/gateway/providerRouter';
import { buildQuizPrompt } from '@/lib/gateway/promptBuilder';
import { ok, fail, parseLLMJson } from '@/lib/gateway/envelope';
import { requireUser } from '@/lib/security/requireUser';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { validateQuiz } from '@/lib/security/validate';
import type { QuizRequest, QuizResponse } from '@/lib/types/gateway';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const start = Date.now();
  const body = await req.json().catch(() => null);

  const user = await requireUser(req as unknown as Parameters<typeof requireUser>[0]);
  if (!user) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 });
  }

  const rl = await checkRateLimit(user.id, user.tier);
  if (!rl.allowed) {
    return NextResponse.json(
      fail('RATE_LIMITED', `Rate limit exceeded. Resets at ${rl.resetAt}.`),
      { status: 429 },
    );
  }

  const validationError = validateQuiz(body);
  if (validationError) {
    return NextResponse.json(fail('BAD_REQUEST', validationError), { status: 400 });
  }

  const reqData = body as QuizRequest;
  const { system, user: userPrompt } = buildQuizPrompt(reqData);

  try {
    const config = getAIConfig('quiz-generator', user.tier);
    const apiKey = getProviderApiKey(config.provider);

    const raw = await callLLM(config.provider, {
      apiKey,
      model: config.model,
      systemPrompt: system,
      userPrompt,
      maxTokens: config.maxTokens,
      temperature: 0.5,
      signal: req.signal,
    });

    const parsed = parseLLMJson<QuizResponse>(raw);

    return NextResponse.json(
      ok(parsed, {
        provider: config.provider,
        model: config.model,
        latencyMs: Date.now() - start,
      }),
    );
  } catch (err) {
    return NextResponse.json(
      fail('PROVIDER_ERROR', (err as Error).message, { latencyMs: Date.now() - start }),
      { status: 502 },
    );
  }
}
