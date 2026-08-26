import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import type { Db } from '@academistream/db'
import { tenantMemberships, users } from '@academistream/db'
import { and, eq, sql } from 'drizzle-orm'
import { DRIZZLE } from '../db/db.module'
import { AuditService } from '../audit/audit.service'

@Injectable()
export class MembersService {
    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        private readonly audit: AuditService,
    ) { }

    async list(tenantId: number) {
        return this.db
            .select({
                userId: users.id,
                email: users.email,
                name: users.name,
                role: tenantMemberships.role,
                membershipId: tenantMemberships.id,
            })
            .from(tenantMemberships)
            .innerJoin(users, eq(users.id, tenantMemberships.userId))
            .where(eq(tenantMemberships.tenantId, tenantId))
    }

    async remove(
        tenantId: number,
        targetUserId: number,
        actorUserId: number,
    ) {
        const [membership] = await this.db
            .select()
            .from(tenantMemberships)
            .where(
                and(
                    eq(tenantMemberships.tenantId, tenantId),
                    eq(tenantMemberships.userId, targetUserId),
                ),
            )
            .limit(1)

        if (!membership) throw new NotFoundException()

        if (membership.role === 'tenant_admin') {
            const [{ count }] = await this.db
                .select({ count: sql<number>`count(*)::int` })
                .from(tenantMemberships)
                .where(
                    and(
                        eq(tenantMemberships.tenantId, tenantId),
                        eq(tenantMemberships.role, 'tenant_admin'),
                    ),
                )

            if (Number(count) <= 1) {
                throw new BadRequestException(
                    'Cannot remove the last tenant_admin',
                )
            }
        }

        const [deleted] = await this.db
            .delete(tenantMemberships)
            .where(eq(tenantMemberships.id, membership.id))
            .returning()

        if (!deleted) throw new NotFoundException()

        await this.audit.record({
            tenantId,
            actorUserId,
            action: 'membership.removed',
            entityType: 'user',
            entityId: targetUserId,
            metadata: { role: membership.role },
        })

        return deleted
    }
}
