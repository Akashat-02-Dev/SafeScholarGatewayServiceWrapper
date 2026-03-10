import { apiFetch } from './apiClient'

export type RoleSummary = {
  roleId: string
  name: string
  description: string
  isSystem: boolean
}

export async function listRoles(accessToken: string) {
  return apiFetch<{ roles: RoleSummary[] }>('/api/admin/roles', { method: 'GET', accessToken })
}

export async function createRole(accessToken: string, name: string, description: string) {
  return apiFetch<{ roleId: string }>('/api/admin/roles', {
    method: 'POST',
    accessToken,
    body: { name, description },
  })
}

export async function assignPermission(accessToken: string, roleId: string, permission: string) {
  return apiFetch<void>('/api/admin/roles/assign-permission', {
    method: 'POST',
    accessToken,
    body: { roleId, permission },
  })
}

export async function assignRoleToUser(accessToken: string, userId: string, roleId: string) {
  return apiFetch<void>('/api/admin/users/assign-role', {
    method: 'POST',
    accessToken,
    body: { userId, roleId },
  })
}
