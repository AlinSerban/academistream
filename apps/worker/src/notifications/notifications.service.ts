import { Inject, Injectable, Logger } from '@nestjs/common'
import type { Db } from '@academistream/db'
import { notifications, tenantMemberships } from '@academistream/db'
import { and, eq } from 'drizzle-orm'
import { DRIZZLE } from '../db/db.module'
import { MAIL } from '../mail/mail.module'
import type { MailService } from '../mail/mail.types'

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name)

    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        @Inject(MAIL) private readonly mail: MailService,
    ) { }

    async notifyTenantStaff(input: {
        tenantId: number
        type: string
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
        userId?: number
        type: string
        title?: string
        body?: string
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
