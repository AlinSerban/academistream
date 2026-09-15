/** Maps machine event keys to short UI labels. */

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  'assignment.created': 'Training assigned',
  'completion.created': 'Training completed',
  'invite.created': 'Organization invite',
  'video.media_failed': 'Video processing failed',
  'video.media_ready': 'Video ready',
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'assignment.created': 'Assignment created',
  'completion.created': 'Training completed',
  'video.published': 'Video published',
  'invite.created': 'Invite created',
  'invite.accepted': 'Invite accepted',
  'invite.revoked': 'Invite revoked',
  'membership.removed': 'Member removed',
}

/** Fallback: `assignment.created` → `Assignment created` */
export function humanizeEventKey(key: string): string {
  return key
    .split(/[._]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatNotificationType(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? humanizeEventKey(type)
}

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? humanizeEventKey(action)
}

export function formatEntityType(entityType: string): string {
  return humanizeEventKey(entityType)
}
