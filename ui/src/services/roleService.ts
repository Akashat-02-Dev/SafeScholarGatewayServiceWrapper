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

export async function isolateUser(accessToken: string, userId: string) {
  return deleteUser(accessToken, userId)
}
