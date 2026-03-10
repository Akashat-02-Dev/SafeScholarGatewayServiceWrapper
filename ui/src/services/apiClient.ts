export type ApiErrorPayload =
  | {
      message?: string
      error?: string
      details?: unknown
    }
  | unknown

export class ApiError extends Error {
  readonly status: number
  readonly requestId: string | null
  readonly payload: ApiErrorPayload

  constructor(message: string, status: number, requestId: string | null, payload: ApiErrorPayload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.requestId = requestId
    this.payload = payload
  }
}

type ApiFetchInit = Omit<RequestInit, 'body' | 'signal'> & {
  accessToken?: string | null
  body?: unknown
  timeoutMs?: number
  requestId?: string
}

function resolveApiBase(): string {
  const raw = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env?.VITE_API_BASE_URL
  return (raw || '').trim().replace(/\/+$/, '')
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

async function readPayload(res: Response): Promise<{ payload: ApiErrorPayload; text: string }> {
  const ct = res.headers.get('Content-Type') || ''
  if (ct.includes('application/json')) {
    try {
      const payload = (await res.json()) as ApiErrorPayload
      const message =
        typeof payload === 'object' && payload
          ? ((payload as { message?: string; error?: string }).message || (payload as { error?: string }).error || '')
          : ''
      return { payload, text: message }
    } catch {
      return { payload: undefined, text: '' }
    }
  }
  const text = await res.text().catch(() => '')
  return { payload: text, text }
}

export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const apiBase = resolveApiBase()
  const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${apiBase}${path}`

  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')

  const requestId = (init.requestId || createRequestId()).trim()
  if (requestId) {
    headers.set('X-Request-Id', requestId)
  }

  if (init.accessToken) {
    headers.set('Authorization', `Bearer ${init.accessToken}`)
  }

  const method = (init.method || (init.body ? 'POST' : 'GET')).toUpperCase()

  const hasBody = init.body !== undefined && init.body !== null && method !== 'GET' && method !== 'HEAD'
  let body: BodyInit | undefined
  if (hasBody) {
    if (typeof init.body === 'string' || init.body instanceof FormData || init.body instanceof URLSearchParams) {
      body = init.body as BodyInit
      if (typeof init.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
    } else {
      body = JSON.stringify(init.body)
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
    }
  }

  const timeoutMs = typeof init.timeoutMs === 'number' && init.timeoutMs > 0 ? init.timeoutMs : 15_000
  const ac = new AbortController()
  const t = window.setTimeout(() => ac.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...init,
      method,
      headers,
      body,
      credentials: init.credentials ?? 'same-origin',
      signal: ac.signal,
    })

    if (!res.ok) {
      const { payload, text } = await readPayload(res)
      const msg = text || `request failed: ${res.status}`
      const rid = res.headers.get('X-Request-Id') || requestId || null
      throw new ApiError(msg, res.status, rid, payload)
    }

    if (res.status === 204) {
      return undefined as T
    }

    const ct = res.headers.get('Content-Type') || ''
    if (ct.includes('application/json')) {
      return (await res.json()) as T
    }
    return (await res.text()) as T
  } finally {
    window.clearTimeout(t)
  }
}
