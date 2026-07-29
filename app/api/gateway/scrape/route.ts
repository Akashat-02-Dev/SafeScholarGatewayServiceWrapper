import { NextRequest, NextResponse } from 'next/server';

import { getScrapeProvider, getProviderApiKey } from '@/lib/gateway/providerRouter';
import { ok, fail } from '@/lib/gateway/envelope';
import { requireUser } from '@/lib/security/requireUser';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { validateScrape } from '@/lib/security/validate';
import type { ScrapeRequest, ScrapeResponse } from '@/lib/types/gateway';

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

  const validationError = validateScrape(body);
  if (validationError) {
    return NextResponse.json(fail('BAD_REQUEST', validationError), { status: 400 });
  }

  const reqData = body as ScrapeRequest;

  try {
    const provider = getScrapeProvider();
    const apiKey = getProviderApiKey(provider);

    let data: ScrapeResponse;

    if (provider === 'firecrawl') {
      const fcRes = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: reqData.url, pageOptions: { fetchPageContent: true } }),
        signal: req.signal,
      });
      if (!fcRes.ok) throw new Error(`Firecrawl ${fcRes.status}`);
      const fcJson = await fcRes.json();
      data = {
        url: reqData.url,
        title: fcJson.data?.metadata?.title ?? reqData.url,
        content: reqData.format === 'html' ? fcJson.data?.html ?? '' : fcJson.data?.markdown ?? fcJson.data?.content ?? '',
        wordCount: (fcJson.data?.content ?? '').split(/\s+/).length,
      };
    } else if (provider === 'jina') {
      const jinaRes = await fetch(`https://r.jina.ai/${reqData.url}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: req.signal,
      });
      if (!jinaRes.ok) throw new Error(`Jina ${jinaRes.status}`);
      const jinaJson = await jinaRes.json();
      data = {
        url: reqData.url,
        title: jinaJson.data?.title ?? reqData.url,
        content: jinaJson.data?.content ?? '',
        wordCount: (jinaJson.data?.content ?? '').split(/\s+/).length,
      };
    } else {
      // scraperapi
      const saRes = await fetch(
        `https://api.scraperapi.com/?url=${encodeURIComponent(reqData.url)}&api_key=${apiKey}`,
        { signal: req.signal },
      );
      if (!saRes.ok) throw new Error(`ScraperAPI ${saRes.status}`);
      const text = await saRes.text();
      data = { url: reqData.url, title: reqData.url, content: text, wordCount: text.split(/\s+/).length };
    }

    // Truncate if maxTokens specified
    if (reqData.maxTokens && data.content.length > reqData.maxTokens * 4) {
      data.content = data.content.slice(0, reqData.maxTokens * 4);
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
