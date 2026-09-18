import { Inject, Injectable, Logger } from '@nestjs/common'
import type { Db } from '@academistream/db'
import { auditEvents } from '@academistream/db'
import { count, desc, eq } from 'drizzle-orm'
import { DRIZZLE } from '../db/db.module'
import type { AuditRecordInput } from './types'
import {
    pageOffset,
    toPageResult,
    type PageParams,
} from '../common/pagination'

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

    async listForTenant(tenantId: number, params: PageParams) {
        const whereClause = eq(auditEvents.tenantId, tenantId)

        const [totalRow] = await this.db
            .select({ total: count() })
            .from(auditEvents)
            .where(whereClause)

        const items = await this.db
            .select({
                id: auditEvents.id,
                tenantId: auditEvents.tenantId,
                actorUserId: auditEvents.actorUserId,
                action: auditEvents.action,
                entityType: auditEvents.entityType,
                entityId: auditEvents.entityId,
                metadata: auditEvents.metadata,
                createdAt: auditEvents.createdAt,
            })
            .from(auditEvents)
            .where(whereClause)
            .orderBy(desc(auditEvents.createdAt))
            .limit(params.pageSize)
            .offset(pageOffset(params))

        return toPageResult(items, Number(totalRow?.total ?? 0), params)
    }
}
