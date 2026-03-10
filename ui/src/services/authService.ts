import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError, apiFetch } from './apiClient'

export type AuthTokens = {
  accessToken: string
  refreshToken: string
}

export type MeResponse = {
  userId: string
  institutionId: string
  email: string
  firstName: string
  lastName: string
  isSysAdmin: boolean
  roles: string[]
  permissions: string[]
}

export type LoginResponse = {
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
}

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

export type AuthContextValue = {
  status: AuthStatus
  tokens: AuthTokens | null
  me: MeResponse | null
  login: (email: string, password: string) => Promise<void>
  oauthLogin: (provider: 'google' | 'microsoft' | 'apple') => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  hasRole: (...roles: string[]) => boolean
  hasPermission: (...permissions: string[]) => boolean
}

const tokenKey = 'safescholar.tokens.v1'

function loadTokens(): AuthTokens | null {
  const raw = sessionStorage.getItem(tokenKey)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AuthTokens>
    if (!parsed.accessToken || !parsed.refreshToken) return null
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
  } catch {
    return null
  }
}

function saveTokens(tokens: AuthTokens | null) {
  if (!tokens) {
    sessionStorage.removeItem(tokenKey)
    return
  }
  sessionStorage.setItem(tokenKey, JSON.stringify(tokens))
}

async function loginViaOAuthPopup(provider: 'google' | 'microsoft' | 'apple'): Promise<LoginResponse> {
  const p = provider.trim().toLowerCase() as 'google' | 'microsoft' | 'apple'
  const popup = window.open(
    `/api/oauth/${encodeURIComponent(p)}/start`,
    'safescholar-oauth',
    'popup=yes,width=520,height=700',
  )

  if (!popup) {
    throw new Error('Popup blocked. Please allow popups and try again.')
  }

  const start = Date.now()
  const maxMs = 120_000

  return new Promise<LoginResponse>((resolve, reject) => {
    const timer = window.setInterval(() => {
      try {
        if (popup.closed) {
          window.clearInterval(timer)
          reject(new Error('OAuth window closed'))
          return
        }

        const href = popup.location.href
        const sameOrigin = href.startsWith(window.location.origin)
        if (!sameOrigin) {
          if (Date.now() - start > maxMs) {
            window.clearInterval(timer)
            try {
              popup.close()
            } catch (e) {
              void e
            }
            reject(new Error('OAuth timed out'))
          }
          return
        }

        const body = popup.document?.body?.innerText || ''
        if (!body.trim()) return
        const parsed = JSON.parse(body) as Partial<LoginResponse>
        if (!parsed.accessToken || !parsed.refreshToken) {
          window.clearInterval(timer)
          reject(new Error('OAuth response missing tokens'))
          return
        }
        window.clearInterval(timer)
        try {
          popup.close()
        } catch (e) {
          void e
        }
        resolve({
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          expiresInSeconds: parsed.expiresInSeconds || 900,
        })
      } catch (e) {
        if (Date.now() - start > maxMs) {
          window.clearInterval(timer)
          try {
            popup.close()
          } catch (e2) {
            void e2
          }
          reject(new Error('OAuth timed out'))
          return
        }
        void e
      }
    }, 500)
  })
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(() => loadTokens())
  const [me, setMe] = useState<MeResponse | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (tokens?.accessToken ? 'loading' : 'anonymous'))

  async function refreshMe() {
    if (!tokens?.accessToken) return
    const data = await apiFetch<MeResponse>('/api/auth/me', { method: 'GET', accessToken: tokens.accessToken })
    setMe(data)
    setStatus('authenticated')
  }

  useEffect(() => {
    if (!tokens?.accessToken) return
    let cancelled = false
    void (async () => {
      try {
        const data = await apiFetch<MeResponse>('/api/auth/me', { method: 'GET', accessToken: tokens.accessToken })
        if (cancelled) return
        setMe(data)
        setStatus('authenticated')
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status !== 401 && err.status !== 403) {
          setStatus('anonymous')
          return
        }
        setMe(null)
        setTokens(null)
        saveTokens(null)
        setStatus('anonymous')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tokens?.accessToken])

  async function login(email: string, password: string) {
    const data = await apiFetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { email, password } })
    const nextTokens = { accessToken: data.accessToken, refreshToken: data.refreshToken }
    setTokens(nextTokens)
    saveTokens(nextTokens)
    const meData = await apiFetch<MeResponse>('/api/auth/me', { method: 'GET', accessToken: nextTokens.accessToken })
    setMe(meData)
    setStatus('authenticated')
  }

  async function oauthLogin(provider: 'google' | 'microsoft' | 'apple') {
    const res = await loginViaOAuthPopup(provider)

    const nextTokens = { accessToken: res.accessToken, refreshToken: res.refreshToken }
    setTokens(nextTokens)
    saveTokens(nextTokens)
    const meData = await apiFetch<MeResponse>('/api/auth/me', { method: 'GET', accessToken: nextTokens.accessToken })
    setMe(meData)
    setStatus('authenticated')
  }

  async function logout() {
    const at = tokens?.accessToken
    setTokens(null)
    setMe(null)
    saveTokens(null)
    setStatus('anonymous')
    if (at) {
      await apiFetch('/api/auth/logout', { method: 'POST', accessToken: at }).catch(() => undefined)
    }
  }

  const hasRole = useMemo(() => {
    return (...roles: string[]) => {
      if (status !== 'authenticated' || !me) return false
      const set = new Set((me.roles || []).map((r) => r.trim().toLowerCase()).filter(Boolean))
      return roles.some((r) => set.has(r.trim().toLowerCase()))
    }
  }, [me, status])

  const hasPermission = useMemo(() => {
    return (...permissions: string[]) => {
      if (status !== 'authenticated' || !me) return false
      if (me.isSysAdmin) return true
      const set = new Set((me.permissions || []).map((p) => p.trim().toUpperCase()).filter(Boolean))
      if (set.has('SUPER_ADMIN')) return true
      return permissions.some((p) => set.has(p.trim().toUpperCase()))
    }
  }, [me, status])

  return createElement(
    AuthContext.Provider,
    { value: { status, tokens, me, login, oauthLogin, logout, refreshMe, hasRole, hasPermission } },
    children,
  )
}

export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) throw new Error('AuthProvider missing')
  return v
}
