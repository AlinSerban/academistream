export type AuditAction =
    | 'assignment.created'
    | 'completion.created'
    | 'video.published'
    | 'invite.created'
    | 'invite.accepted'
    | 'invite.revoked'
    | 'membership.removed'

export interface AuditRecordInput {
    tenantId: number
    actorUserId?: number | null
    action: AuditAction | string
    entityType?: string
    entityId?: number
    metadata?: Record<string, unknown>
}
