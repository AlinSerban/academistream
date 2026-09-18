import { Inject, Injectable, Logger } from '@nestjs/common'
import type { Db } from '@academistream/db'
import { auditEvents } from '@academistream/db'
import { desc, eq } from 'drizzle-orm'
import { DRIZZLE } from '../db/db.module'
import type { AuditRecordInput } from './types'

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name)

    constructor(@Inject(DRIZZLE) private readonly db: Db) { }

    /** Best-effort: failures are logged and never throw. */
    async record(input: AuditRecordInput): Promise<void> {
        try {
            await this.db.insert(auditEvents).values({
                tenantId: input.tenantId,
                actorUserId: input.actorUserId ?? null,
                action: input.action,
                entityType: input.entityType ?? null,
                entityId: input.entityId ?? null,
                metadata: input.metadata
                    ? JSON.stringify(input.metadata)
                    : null,
            })
        } catch (err) {
            this.logger.warn(
                `audit record failed for ${input.action}: ${String(err)}`,
            )
        }
    }

    async listForTenant(tenantId: number, limit = 100) {
        return this.db
            .select()
            .from(auditEvents)
            .where(eq(auditEvents.tenantId, tenantId))
            .orderBy(desc(auditEvents.createdAt))
            .limit(Math.min(Math.max(limit, 1), 500))
    }
}
