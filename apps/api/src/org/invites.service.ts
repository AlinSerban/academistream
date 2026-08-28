import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import type { Db } from '@academistream/db'
import { invites, tenantMemberships, users } from '@academistream/db'
import { and, eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import bcrypt from 'bcrypt'
import { DRIZZLE } from '../db/db.module'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { QuotasService } from '../quotas/quotas.service'
import type { AcceptInviteInput, CreateInviteInput, InviteRole } from './types'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ALLOWED_ROLES: InviteRole[] = ['tenant_admin', 'instructor', 'learner']

@Injectable()
export class InvitesService {
    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        private readonly audit: AuditService,
        private readonly notifications: NotificationsService,
        private readonly quotas: QuotasService,
    ) { }

    async create(
        tenantId: number,
        invitedByUserId: number,
        input: CreateInviteInput,
    ) {
        const email = input.email.trim().toLowerCase()
        if (!email) throw new BadRequestException('Email required')
        if (!ALLOWED_ROLES.includes(input.role)) {
            throw new BadRequestException('Invalid role')
        }

        const [pending] = await this.db
            .select()
            .from(invites)
            .where(
                and(
                    eq(invites.tenantId, tenantId),
                    eq(invites.email, email),
                    eq(invites.status, 'pending'),
                ),
            )
            .limit(1)

        if (pending) {
            throw new BadRequestException(
                'A pending invite already exists for this email',
            )
        }

        const rawToken = randomBytes(32).toString('hex')
        const tokenHash = await bcrypt.hash(rawToken, 10)
        const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

        const [created] = await this.db
            .insert(invites)
            .values({
                tenantId,
                email,
                role: input.role,
                tokenHash,
                status: 'pending',
                invitedByUserId,
                expiresAt,
            })
            .returning()

        if (!created) throw new NotFoundException()

        await this.audit.record({
            tenantId,
            actorUserId: invitedByUserId,
            action: 'invite.created',
            entityType: 'invite',
            entityId: created.id,
            metadata: { email, role: input.role },
        })

        const [existingUser] = await this.db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1)

        await this.notifications.notify({
            tenantId,
            userId: existingUser?.id,
            type: 'invite.created',
            title: 'Organization invite',
            body: `You were invited as ${input.role}. Use your invite link to join.`,
            email,
        })

        return {
            id: created.id,
            email: created.email,
            role: created.role,
            status: created.status,
            expiresAt: created.expiresAt,
            createdAt: created.createdAt,
            token: rawToken,
        }
    }

    async listPending(tenantId: number) {
        return this.db
            .select({
                id: invites.id,
                email: invites.email,
                role: invites.role,
                status: invites.status,
                expiresAt: invites.expiresAt,
                createdAt: invites.createdAt,
                invitedByUserId: invites.invitedByUserId,
            })
            .from(invites)
            .where(
                and(
                    eq(invites.tenantId, tenantId),
                    eq(invites.status, 'pending'),
                ),
            )
    }

    async revoke(inviteId: number, tenantId: number, actorUserId: number) {
        const [updated] = await this.db
            .update(invites)
            .set({ status: 'revoked' })
            .where(
                and(
                    eq(invites.id, inviteId),
                    eq(invites.tenantId, tenantId),
                    eq(invites.status, 'pending'),
                ),
            )
            .returning()

        if (!updated) throw new NotFoundException()

        await this.audit.record({
            tenantId,
            actorUserId,
            action: 'invite.revoked',
            entityType: 'invite',
            entityId: updated.id,
        })

        return updated
    }

    async accept(input: AcceptInviteInput) {
        const token = input.token?.trim()
        if (!token) throw new BadRequestException('Token required')

        const candidates = await this.db
            .select()
            .from(invites)
            .where(eq(invites.status, 'pending'))

        let invite = null as (typeof candidates)[number] | null
        for (const row of candidates) {
            if (await bcrypt.compare(token, row.tokenHash)) {
                invite = row
                break
            }
        }

        if (!invite) {
            throw new BadRequestException('Invalid or revoked invite')
        }
        if (invite.expiresAt.getTime() < Date.now()) {
            throw new BadRequestException('Invite expired')
        }

        let user = (
            await this.db
                .select()
                .from(users)
                .where(eq(users.email, invite.email))
                .limit(1)
        )[0]

        if (!user) {
            const name = input.name?.trim()
            const password = input.password
            if (!name || !password || password.length < 8) {
                throw new BadRequestException(
                    'name and password (min 8) required for new users',
                )
            }
            const passwordHash = await bcrypt.hash(password, 10)
            const [created] = await this.db
                .insert(users)
                .values({
                    email: invite.email,
                    name,
                    passwordHash,
                })
                .returning()
            user = created
        }

        if (!user) throw new NotFoundException()

        const [existingMembership] = await this.db
            .select()
            .from(tenantMemberships)
            .where(
                and(
                    eq(tenantMemberships.userId, user.id),
                    eq(tenantMemberships.tenantId, invite.tenantId),
                ),
            )
            .limit(1)

        if (!existingMembership) {
            await this.quotas.assertCanAddMember(invite.tenantId)
            await this.db.insert(tenantMemberships).values({
                userId: user.id,
                tenantId: invite.tenantId,
                role: invite.role,
            })
        }

        await this.db
            .update(invites)
            .set({ status: 'accepted' })
            .where(eq(invites.id, invite.id))

        await this.audit.record({
            tenantId: invite.tenantId,
            actorUserId: user.id,
            action: 'invite.accepted',
            entityType: 'invite',
            entityId: invite.id,
            metadata: { email: invite.email, role: invite.role },
        })

        return {
            userId: user.id,
            email: user.email,
            tenantId: invite.tenantId,
            role: invite.role,
        }
    }
}
