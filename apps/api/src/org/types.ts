export type InviteRole = 'tenant_admin' | 'instructor' | 'learner'

export interface CreateInviteInput {
    email: string
    role: InviteRole
}

export interface AcceptInviteInput {
    token: string
    name?: string
    password?: string
}
