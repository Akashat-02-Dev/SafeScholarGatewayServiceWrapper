import { NextRequest, NextResponse } from 'next/server';

import { getTranslateProvider, getProviderApiKey } from '@/lib/gateway/providerRouter';
import { ok, fail } from '@/lib/gateway/envelope';
import { requireUser } from '@/lib/security/requireUser';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { validateTranslate } from '@/lib/security/validate';
import type { TranslateRequest, TranslateResponse } from '@/lib/types/gateway';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const start = Date.now();
  const body = await req.json().catch(() => null);

  const user = await requireUser(req as unknown as Parameters<typeof requireUser>[0]);
  if (!user) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 });
  }

  const rl = await checkRateLimit(user.id, user.tier);
  if (!rl.allowed) {
    return NextResponse.json(fail('RATE_LIMITED', `Resets at ${rl.resetAt}.`), { status: 429 });
  }

  const validationError = validateTranslate(body);
  if (validationError) {
    return NextResponse.json(fail('BAD_REQUEST', validationError), { status: 400 });
  }

  const reqData = body as TranslateRequest;

  try {
    const provider = getTranslateProvider();
    const apiKey = getProviderApiKey(provider);
    let data: TranslateResponse;

    if (provider === 'deepl') {
      const params = new URLSearchParams({
        auth_key: apiKey,
        text: reqData.text,
        source_lang: reqData.sourceLang.toUpperCase(),
        target_lang: reqData.targetLang.toUpperCase(),
      });
      const res = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        signal: req.signal,
      });
      if (!res.ok) throw new Error(`DeepL ${res.status}`);
      const json = await res.json();
      data = {
        translatedText: json.translations?.[0]?.text ?? '',
        detectedSourceLang: json.translations?.[0]?.detected_source_language,
      };
    } else if (provider === 'google') {
      const res = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: reqData.text, source: reqData.sourceLang, target: reqData.targetLang, format: 'text' }),
          signal: req.signal,
        },
      );
      if (!res.ok) throw new Error(`Google Translate ${res.status}`);
      const json = await res.json();
      data = { translatedText: json.data?.translations?.[0]?.translatedText ?? '' };
    } else {
      // LibreTranslate (self-hosted)
      const res = await fetch(`${process.env.LIBRETRANSLATE_URL || 'http://localhost:5000'}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: reqData.text, source: reqData.sourceLang, target: reqData.targetLang, format: 'text', api_key: apiKey }),
        signal: req.signal,
      });
      if (!res.ok) throw new Error(`LibreTranslate ${res.status}`);
      const json = await res.json();
      data = { translatedText: json.translatedText ?? '' };
    }

    return NextResponse.json(
      ok(data, { provider, latencyMs: Date.now() - start }),
    );
  } catch (err) {
    return NextResponse.json(
      fail('PROVIDER_ERROR', (err as Error).message, { latencyMs: Date.now() - start }),
      { status: 502 },
    );
  }
}
