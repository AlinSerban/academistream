import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import type { Db } from '@academistream/db'
import { tenantMemberships, users } from '@academistream/db'
import { and, count, eq, sql } from 'drizzle-orm'
import { DRIZZLE } from '../db/db.module'
import { AuditService } from '../audit/audit.service'
import {
    pageOffset,
    toPageResult,
    type PageParams,
    type PageResult,
} from '../common/pagination'

export type MemberListItem = {
    userId: number
    email: string
    name: string
    role: string
    membershipId: number
}

@Injectable()
export class MembersService {
    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        private readonly audit: AuditService,
    ) { }

    async list(
        tenantId: number,
        params: PageParams,
    ): Promise<PageResult<MemberListItem>> {
        const whereClause = eq(tenantMemberships.tenantId, tenantId)

        const [totalRow] = await this.db
            .select({ total: count() })
            .from(tenantMemberships)
            .where(whereClause)

        const items = await this.db
            .select({
                userId: users.id,
                email: users.email,
                name: users.name,
                role: tenantMemberships.role,
                membershipId: tenantMemberships.id,
            })
            .from(tenantMemberships)
            .innerJoin(users, eq(users.id, tenantMemberships.userId))
            .where(whereClause)
            .orderBy(sql`lower(${users.name})`)
            .limit(params.pageSize)
            .offset(pageOffset(params))

        return toPageResult(items, Number(totalRow?.total ?? 0), params)
    }

    async remove(
        tenantId: number,
        targetUserId: number,
        actorUserId: number,
    ) {
        const [membership] = await this.db
            .select({
                id: tenantMemberships.id,
                role: tenantMemberships.role,
            })
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
            const [{ count: adminCount }] = await this.db
                .select({ count: count() })
                .from(tenantMemberships)
                .where(
                    and(
                        eq(tenantMemberships.tenantId, tenantId),
                        eq(tenantMemberships.role, 'tenant_admin'),
                    ),
                )

            if (Number(adminCount) <= 1) {
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
        })

        return deleted
    }
}
