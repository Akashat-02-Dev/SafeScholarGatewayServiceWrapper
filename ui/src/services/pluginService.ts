import { apiFetch } from './apiClient'

export type PluginCategory = 'core' | 'ai_education' | 'microservice' | 'governance' | 'integration' | 'custom'
export type PluginStatus = 'active' | 'degraded' | 'circuit_open' | 'disabled'
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface PluginView {
  id: string
  name: string
  category: PluginCategory
  version: string
  description: string
  enabled: boolean
  isSystem?: boolean
  status: PluginStatus
  targetService: string
  targetUrl?: string
  endpointPrefix: string
  requiredPermission: string
  failureThreshold: number
  timeoutSeconds: number
  cooldownSeconds: number
  fallbackMode: string
  customFallbackPayload?: string
  circuitState: CircuitState
  consecutiveFailures: number
  totalRequests: number
  totalFailures: number
  totalSuccesses: number
  lastFailureTime?: string
  lastSuccessTime?: string
  lastStateChange: string
  avgLatencyMs: number
  tenantOverride?: boolean
}

export interface CreatePluginRequest {
  id: string
  name: string
  category: PluginCategory
  version?: string
  description?: string
  enabled?: boolean
  targetService?: string
  targetUrl?: string
  endpointPrefix: string
  requiredPermission?: string
  failureThreshold?: number
  timeoutSeconds?: number
  cooldownSeconds?: number
  fallbackMode?: string
  customFallbackPayload?: string
}

export interface UpdatePluginRequest {
  pluginId: string
  name?: string
  category?: PluginCategory
  version?: string
  description?: string
  enabled?: boolean
  targetService?: string
  targetUrl?: string
  endpointPrefix?: string
  requiredPermission?: string
  failureThreshold?: number
  timeoutSeconds?: number
  cooldownSeconds?: number
  fallbackMode?: string
  customFallbackPayload?: string
}

export interface UpdatePluginConfigRequest {
  pluginId: string
  failureThreshold: number
  timeoutSeconds: number
  cooldownSeconds: number
  fallbackMode: string
}

export interface HealthProbeResult {
  pluginId: string
  targetService: string
  healthy: boolean
  detail: string
  latencyMs: number
  circuitState: CircuitState
}

export async function listPlugins(accessToken: string, institutionId?: string) {
  const query = institutionId ? `?institutionId=${encodeURIComponent(institutionId)}` : ''
  return apiFetch<{ plugins: PluginView[] }>(`/api/v1/admin/plugins${query}`, {
    method: 'GET',
    accessToken,
  })
}

export async function createPlugin(accessToken: string, req: CreatePluginRequest) {
  return apiFetch<{ message: string; plugin: PluginView }>('/api/v1/admin/plugins/create', {
    method: 'POST',
    accessToken,
    body: req,
  })
}

export async function updatePlugin(accessToken: string, req: UpdatePluginRequest) {
  return apiFetch<{ message: string }>('/api/v1/admin/plugins/update', {
    method: 'POST',
    accessToken,
    body: req,
  })
}

export async function deletePlugin(accessToken: string, pluginId: string) {
  return apiFetch<{ message: string; pluginId: string }>('/api/v1/admin/plugins/delete', {
    method: 'POST',
    accessToken,
    body: { pluginId },
  })
}

export async function togglePlugin(accessToken: string, pluginId: string, enabled: boolean) {
  return apiFetch<{ message: string; pluginId: string; enabled: boolean }>('/api/v1/admin/plugins/toggle', {
    method: 'POST',
    accessToken,
    body: { pluginId, enabled },
  })
}

export async function updatePluginConfig(accessToken: string, config: UpdatePluginConfigRequest) {
  return apiFetch<{ message: string }>('/api/v1/admin/plugins/config', {
    method: 'POST',
    accessToken,
    body: config,
  })
}

export async function resetCircuit(accessToken: string, pluginId: string) {
  return apiFetch<{ message: string; pluginId: string }>('/api/v1/admin/plugins/reset-circuit', {
    method: 'POST',
    accessToken,
    body: { pluginId },
  })
}

export async function setTenantOverride(accessToken: string, institutionId: string, pluginId: string, enabled: boolean) {
  return apiFetch<{ message: string }>('/api/v1/admin/plugins/tenant-override', {
    method: 'POST',
    accessToken,
    body: { institutionId, pluginId, enabled },
  })
}

export async function probePluginHealth(accessToken: string, pluginId: string) {
  return apiFetch<HealthProbeResult>('/api/v1/admin/plugins/health-check', {
    method: 'POST',
    accessToken,
    body: { pluginId },
  })
}
