export type NotificationType =
    | 'assignment.created'
    | 'video.media_failed'
    | 'completion.created'
    | 'invite.created'

export interface NotifyTenantStaffInput {
    tenantId: number
    type: NotificationType | string
    title?: string
    body?: string
}

export interface NotifyInput {
    tenantId: number
    /** Omit for invitee-only email when the user account does not exist yet. */
    userId?: number
    type: NotificationType | string
    title?: string
    body?: string
    /** When set, the local mailer logs a would-send. */
    email?: string
}
