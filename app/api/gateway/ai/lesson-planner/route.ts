import { NextRequest, NextResponse } from 'next/server';

import { callLLM } from '@/lib/gateway/llmCallers';
import { getAIConfig, getProviderApiKey } from '@/lib/gateway/providerRouter';
import { buildLessonPlanPrompt } from '@/lib/gateway/promptBuilder';
import { ok, fail, parseLLMJson } from '@/lib/gateway/envelope';
import { requireUser } from '@/lib/security/requireUser';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { validateLessonPlan } from '@/lib/security/validate';
import type { LessonPlanRequest, LessonPlanResponse } from '@/lib/types/gateway';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const start = Date.now();
  const body = await req.json().catch(() => null);

  // 1. Auth
  const user = await requireUser(req as unknown as Parameters<typeof requireUser>[0]);
  if (!user) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 });
  }

  // 2. Rate-limit
  const rl = await checkRateLimit(user.id, user.tier);
  if (!rl.allowed) {
    return NextResponse.json(
      fail('RATE_LIMITED', `Rate limit exceeded. Resets at ${rl.resetAt}.`),
      { status: 429, headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': rl.resetAt } },
    );
  }

  // 3. Validate
  const validationError = validateLessonPlan(body);
  if (validationError) {
    return NextResponse.json(fail('BAD_REQUEST', validationError), { status: 400 });
  }

  // 4. Build prompt
  const reqData = body as LessonPlanRequest;
  const { system, user: userPrompt } = buildLessonPlanPrompt(reqData);

  // 5. Call LLM
  try {
    const config = getAIConfig('lesson-planner', user.tier);
    const apiKey = getProviderApiKey(config.provider);

    const raw = await callLLM(config.provider, {
      apiKey,
      model: config.model,
      systemPrompt: system,
      userPrompt,
      maxTokens: config.maxTokens,
      temperature: 0.7,
      signal: req.signal,
    });

    const parsed = parseLLMJson<LessonPlanResponse>(raw);

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
