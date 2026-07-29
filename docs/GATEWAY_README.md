# SafeScholar AI Gateway Integration

A unified proxy layer that routes all AI, scraping, and translation calls through
server-side Next.js API routes — keeping API keys secure, enforcing rate limits,
and normalising responses.

## Architecture

```
Client Component ─► useGateway() hook ─► gatewayClient ─► /api/gateway/* ─► Provider
     │                                      │                   │              │
     │                                      │                   ├─ requireUser (auth)
     │                                      │                   ├─ checkRateLimit
     │                                      │                   └─ validate input
     └──────── GatewayResponse<T> ◄─────────┴───────────────────┘
```

### Key design decisions

1. **Keys never reach the browser** — all provider calls happen server-side in
   Next.js Route Handlers (`app/api/gateway/*/route.ts`).
2. **Normalised envelope** — every response matches `GatewayResponse<T>` so the
   client always knows how to handle success vs error.
3. **Provider-agnostic** — swap OpenAI → Anthropic → Gemini by changing one env
   var, no client code changes needed.
4. **Per-user rate limiting** — token-bucket via Upstash Redis (in-memory
   fallback for dev).

## File structure

```
lib/
  types/gateway.ts              # All shared TypeScript types
  gateway/
    gatewayClient.ts            # Client-side fetch wrapper (import in "use client")
    providerRouter.ts           # Maps task → provider + model via env vars
    llmCallers.ts               # Thin wrappers for OpenAI / Anthropic / Gemini
    promptBuilder.ts            # System + user prompts for each AI task
    envelope.ts                 # ok() / fail() / parseLLMJson() helpers
  security/
    requireUser.ts              # NextAuth session extraction
    rateLimit.ts                # Token-bucket limiter (Redis or in-memory)
    validate.ts                 # Input validation for each endpoint

app/api/gateway/
  ai/lesson-planner/route.ts    # POST → lesson plan JSON
  ai/quiz-generator/route.ts    # POST → quiz JSON
  ai/flashcard/route.ts         # POST → flashcard deck JSON
  scrape/route.ts               # POST → scraped URL content
  translate/route.ts            # POST → translated text

hooks/
  useGateway.ts                 # React hooks: useLessonPlanner(), useQuizGenerator(), …

components/dashboard/
  LessonPlannerPanel.tsx        # Example UI component

config/
  env.ts                        # Env var template (typed)
  auth.ts                       # NextAuth configuration
```

## Quick start

1. **Install dependencies**

   ```bash
   npm install next-auth
   # If using Redis for rate limiting:
   # (works without — falls back to in-memory)
   ```

2. **Copy environment variables**

   ```bash
   cp .env.example .env.local
   # Fill in at least one AI provider key
   ```

3. **Use in a component**

   ```tsx
   import { useLessonPlanner } from '@/hooks/useGateway';

   function MyComponent() {
     const { data, loading, error, execute } = useLessonPlanner();

     const handleClick = () => execute({
       topic: 'Photosynthesis',
       gradeLevel: '9-12',
       durationMinutes: 45,
     });

     return (
       <>
         <button onClick={handleClick} disabled={loading}>Generate</button>
         {error && <p>{error}</p>}
         {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
       </>
     );
   }
   ```

## Adding a new AI task

1. Add request/response types to `lib/types/gateway.ts`.
2. Add a prompt builder in `lib/gateway/promptBuilder.ts`.
3. Add provider config in `lib/gateway/providerRouter.ts`.
4. Create `app/api/gateway/ai/<task>/route.ts` (copy from lesson-planner).
5. Add a method to `gatewayClient.ts` and a hook in `hooks/useGateway.ts`.

## Rate limits

| Tier  | Requests / hour |
|-------|-----------------|
| Free  | 20              |
| Pro   | 200             |
| Admin | 1000            |

Configure in `lib/security/rateLimit.ts`.
