export type InviteRole = 'tenant_admin' | 'instructor' | 'learner'

export type InviteStatus = 'pending' | 'accepted' | 'revoked'

export interface Invite {
  id: number
  email: string
  role: InviteRole
  status: InviteStatus
  expiresAt: string
  createdAt: string
  invitedByUserId: number | null
}

export interface CreateInviteRequest {
  email: string
  role: InviteRole
}

export interface CreateInviteResponse extends Invite {
  token: string
}

export interface AcceptInviteRequest {
  token: string
  name?: string
  password?: string
}

export interface AcceptInviteResponse {
  userId: number
  email: string
  tenantId: number
  role: InviteRole
}

export interface Member {
  userId: number
  email: string
  name: string
  role: InviteRole
  membershipId: number
}

export interface AuditEvent {
  id: number
  tenantId: number
  actorUserId: number | null
  action: string
  entityType: string | null
  entityId: number | null
  metadata: string | null
  createdAt: string
}
