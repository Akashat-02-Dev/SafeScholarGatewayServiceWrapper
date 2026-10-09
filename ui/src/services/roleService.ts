import { apiFetch } from './apiClient'

export type RoleSummary = {
  roleId: string
  institutionId?: string
  name: string
  description: string
  isSystem: boolean
  permissions?: string[]
  userCount?: number
}

export type PermissionItem = {
  permissionId: string
  name: string
  description: string
  module: string
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

export async function updateRole(accessToken: string, roleId: string, name: string, description: string) {
  return apiFetch<{ message: string }>('/api/admin/roles/update', {
    method: 'POST',
    accessToken,
    body: { roleId, name, description },
  })
}

export async function deleteRole(accessToken: string, roleId: string) {
  return apiFetch<{ message: string }>('/api/admin/roles/delete', {
    method: 'POST',
    accessToken,
    body: { roleId },
  })
}

export async function assignPermission(accessToken: string, roleId: string, permission: string) {
  return apiFetch<void>('/api/admin/roles/assign-permission', {
    method: 'POST',
    accessToken,
    body: { roleId, permission },
  })
}

export async function unassignPermission(accessToken: string, roleId: string, permission: string) {
  return apiFetch<void>('/api/admin/roles/unassign-permission', {
    method: 'POST',
    accessToken,
    body: { roleId, permission },
  })
}

export async function listAllPermissions(accessToken: string) {
  return apiFetch<{ permissions: PermissionItem[] }>('/api/admin/permissions', {
    method: 'GET',
    accessToken,
  })
}

export async function createCustomPermission(accessToken: string, name: string, description: string, module: string) {
  return apiFetch<{ message: string }>('/api/admin/permissions', {
    method: 'POST',
    accessToken,
    body: { name, description, module },
  })
}

export async function deleteCustomPermission(accessToken: string, name: string) {
  return apiFetch<{ message: string }>('/api/admin/permissions/delete', {
    method: 'POST',
    accessToken,
    body: { name },
  })
}

export async function assignRoleToUser(accessToken: string, userId: string, roleId: string) {
  return apiFetch<void>('/api/admin/users/assign-role', {
    method: 'POST',
    accessToken,
    body: { userId, roleId },
  })
}

export type UserSummary = {
  userId: string
  institutionId: string
  email: string
  firstName: string
  lastName: string
  status: string
  isSysAdmin: boolean
  roles: string[]
}

export async function listUsers(accessToken: string) {
  return apiFetch<{ users: UserSummary[] }>('/api/admin/users', { method: 'GET', accessToken })
}

export async function approveUser(accessToken: string, userId: string, status: string, roleId?: string) {
  return apiFetch<void>('/api/admin/users/approve', {
    method: 'POST',
    accessToken,
    body: { userId, status, roleId },
  })
}

export interface ApprovalRequest {
  requestId: string
  userId: string
  email: string
  firstName: string
  lastName: string
  requestedRole: string
  status: string
  createdAt: string
}

export async function listApprovalRequests(accessToken: string) {
  return apiFetch<{ requests: ApprovalRequest[] }>('/api/admin/users/approvals', { method: 'GET', accessToken })
}

export async function deleteUser(accessToken: string, userId: string) {
  return apiFetch<void>('/api/v1/admin/users/delete', {
    method: 'POST',
    accessToken,
    body: { userId },
  })
}

export async function isolateUserAccount(userId: string, institutionId: string) {
  const raw = sessionStorage.getItem('safescholar.tokens.v1')
  let accessToken = ''
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      accessToken = parsed.accessToken
    } catch {}
  }
  
  return apiFetch<void>('/api/v1/admin/users/isolate', {
    method: 'POST',
    accessToken,
    body: { userId, institution_id: institutionId },
  })
}
