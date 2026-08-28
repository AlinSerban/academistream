import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Db } from '@academistream/db'
import { notifications, tenantMemberships } from '@academistream/db'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { DRIZZLE } from '../db/db.module'
import { MAIL } from '../mail/mail.module'
import type { MailService } from '../mail/mail.types'
import type { NotificationType } from './types'

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name)

    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        @Inject(MAIL) private readonly mail: MailService,
    ) { }

    /**
     * Best-effort in-app notification (+ optional email stub).
     * Failures are logged and never throw, so primary actions are not blocked.
     *
     * notifyTenantStaff: first tenant_admin, else first instructor (no uploader on videos).
     */
    async notifyTenantStaff(input: {
        tenantId: number
        type: NotificationType | string
        title?: string
        body?: string
    }): Promise<void> {
        const userId = await this.findStaffRecipient(input.tenantId)
        if (userId == null) {
            this.logger.warn(
                `no staff recipient for tenant ${input.tenantId} (${input.type})`,
            )
            return
        }
        await this.notify({ ...input, userId })
    }

    async notify(input: {
        tenantId: number
        /** Omit for invitee-only email when the user account does not exist yet. */
        userId?: number
        type: NotificationType | string
        title?: string
        body?: string
        /** When set, the local mail stub logs a would-send (S5-02); SES commented in mailer. */
        email?: string
    }): Promise<void> {
        if (input.userId != null) {
            try {
                await this.db.insert(notifications).values({
                    tenantId: input.tenantId,
                    userId: input.userId,
                    type: input.type,
                    title: input.title ?? null,
                    body: input.body ?? null,
                })
            } catch (err) {
                this.logger.warn(
                    `notification insert failed for ${input.type}: ${String(err)}`,
                )
            }
        }

        if (!input.email) return

        const subject = input.title ?? input.type
        const body = input.body ?? subject

        try {
            await this.mail.send({
                to: input.email,
                subject,
                body,
            })
        } catch (err) {
            this.logger.warn(
                `mail stub failed for ${input.type} to ${input.email}: ${String(err)}`,
            )
        }
    }

    async listForUser(tenantId: number, userId: number, limit = 50) {
        return this.db
            .select()
            .from(notifications)
            .where(
                and(
                    eq(notifications.tenantId, tenantId),
                    eq(notifications.userId, userId),
                ),
            )
            .orderBy(desc(notifications.createdAt))
            .limit(Math.min(Math.max(limit, 1), 100))
    }

    async markRead(
        tenantId: number,
        userId: number,
        notificationId: number,
    ) {
        const [updated] = await this.db
            .update(notifications)
            .set({ readAt: new Date() })
            .where(
                and(
                    eq(notifications.id, notificationId),
                    eq(notifications.tenantId, tenantId),
                    eq(notifications.userId, userId),
                ),
            )
            .returning()

        if (!updated) throw new NotFoundException()
        return updated
    }

    async markAllRead(tenantId: number, userId: number) {
        return this.db
            .update(notifications)
            .set({ readAt: new Date() })
            .where(
                and(
                    eq(notifications.tenantId, tenantId),
                    eq(notifications.userId, userId),
                    isNull(notifications.readAt),
                ),
            )
            .returning()
    }

    private async findStaffRecipient(tenantId: number): Promise<number | null> {
        for (const role of ['tenant_admin', 'instructor'] as const) {
            const [row] = await this.db
                .select({ userId: tenantMemberships.userId })
                .from(tenantMemberships)
                .where(
                    and(
                        eq(tenantMemberships.tenantId, tenantId),
                        eq(tenantMemberships.role, role),
                    ),
                )
                .limit(1)
            if (row) return row.userId
        }
        return null
    }
}
