/** Documented notification types (S5-03 hooks use this union). */
export type NotificationType =
    | 'assignment.created'
    | 'video.media_failed'
    | 'completion.created'
    | 'invite.created'
