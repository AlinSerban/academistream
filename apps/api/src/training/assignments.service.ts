import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import type { Db } from '@academistream/db'
import {
    assignments,
    completions,
    tenantMemberships,
    users,
    videos,
    watchProgress,
} from '@academistream/db'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { DRIZZLE } from '../db/db.module'
import type { CreateAssignmentInput } from './types'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import {
    pageOffset,
    toPageResult,
    type PageParams,
    type PageResult,
} from '../common/pagination'

export type AssignmentListItem = {
    id: number
    tenantId: number
    videoId: number
    userId: number
    assignedByUserId: number | null
    createdAt: Date
    videoTitle: string | null
}

export type MyAssignmentListItem = AssignmentListItem & {
    percent: number
    positionSeconds: number
    completed: boolean
}

export type LearnerOption = {
    userId: number
    email: string
    name: string
}

@Injectable()
export class AssignmentsService {
    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        private readonly audit: AuditService,
        private readonly notifications: NotificationsService,
    ) { }

    async create(
        tenantId: number,
        assignedByUserId: number,
        input: CreateAssignmentInput,
    ) {
        const video = await this.assertVideoInTenant(input.videoId, tenantId)
        await this.assertLearnerInTenant(input.userId, tenantId)

        const [created] = await this.db
            .insert(assignments)
            .values({
                tenantId,
                videoId: input.videoId,
                userId: input.userId,
                assignedByUserId,
            })
            .returning()

        if (!created) throw new NotFoundException()

        await this.audit.record({
            tenantId,
            actorUserId: assignedByUserId,
            action: 'assignment.created',
            entityType: 'assignment',
            entityId: created.id,
            metadata: { videoId: input.videoId, userId: input.userId },
        })

        await this.notifications.notify({
            tenantId,
            userId: input.userId,
            type: 'assignment.created',
            title: 'New training assigned',
            body: `You were assigned: ${video.title}`,
        })

        return created
    }

    async listForTenant(
        tenantId: number,
        params: PageParams,
    ): Promise<PageResult<AssignmentListItem>> {
        const whereClause = eq(assignments.tenantId, tenantId)

        const [totalRow] = await this.db
            .select({ total: count() })
            .from(assignments)
            .where(whereClause)

        const items = await this.db
            .select({
                id: assignments.id,
                tenantId: assignments.tenantId,
                videoId: assignments.videoId,
                userId: assignments.userId,
                assignedByUserId: assignments.assignedByUserId,
                createdAt: assignments.createdAt,
                videoTitle: videos.title,
            })
            .from(assignments)
            .innerJoin(videos, eq(videos.id, assignments.videoId))
            .where(whereClause)
            .orderBy(desc(assignments.id))
            .limit(params.pageSize)
            .offset(pageOffset(params))

        return toPageResult(items, Number(totalRow?.total ?? 0), params)
    }

    async listMine(
        tenantId: number,
        userId: number,
        params: PageParams,
    ): Promise<
        PageResult<MyAssignmentListItem> & {
            stats: {
                assigned: number
                inProgress: number
                completed: number
                notStarted: number
            }
            continueAssignment: MyAssignmentListItem | null
        }
    > {
        const whereClause = and(
            eq(assignments.tenantId, tenantId),
            eq(assignments.userId, userId),
        )

        const [totalRow] = await this.db
            .select({ total: count() })
            .from(assignments)
            .where(whereClause)

        const baseSelect = {
            id: assignments.id,
            tenantId: assignments.tenantId,
            videoId: assignments.videoId,
            userId: assignments.userId,
            assignedByUserId: assignments.assignedByUserId,
            createdAt: assignments.createdAt,
            videoTitle: videos.title,
            percent: sql<number>`coalesce(${watchProgress.percent}, 0)`.mapWith(Number),
            positionSeconds: sql<number>`coalesce(${watchProgress.positionSeconds}, 0)`.mapWith(
                Number,
            ),
            completed: sql<boolean>`(${completions.id} is not null)`.mapWith(Boolean),
        }

        const items = await this.db
            .select(baseSelect)
            .from(assignments)
            .innerJoin(videos, eq(videos.id, assignments.videoId))
            .leftJoin(
                watchProgress,
                and(
                    eq(watchProgress.tenantId, assignments.tenantId),
                    eq(watchProgress.userId, assignments.userId),
                    eq(watchProgress.videoId, assignments.videoId),
                ),
            )
            .leftJoin(
                completions,
                and(
                    eq(completions.tenantId, assignments.tenantId),
                    eq(completions.userId, assignments.userId),
                    eq(completions.videoId, assignments.videoId),
                ),
            )
            .where(whereClause)
            .orderBy(desc(assignments.id))
            .limit(params.pageSize)
            .offset(pageOffset(params))

        const [statsRow] = await this.db
            .select({
                assigned: count(),
                completed: sql<number>`count(*) filter (where ${completions.id} is not null)`.mapWith(
                    Number,
                ),
                inProgress: sql<number>`count(*) filter (where ${completions.id} is null and coalesce(${watchProgress.percent}, 0) > 0)`.mapWith(
                    Number,
                ),
            })
            .from(assignments)
            .leftJoin(
                watchProgress,
                and(
                    eq(watchProgress.tenantId, assignments.tenantId),
                    eq(watchProgress.userId, assignments.userId),
                    eq(watchProgress.videoId, assignments.videoId),
                ),
            )
            .leftJoin(
                completions,
                and(
                    eq(completions.tenantId, assignments.tenantId),
                    eq(completions.userId, assignments.userId),
                    eq(completions.videoId, assignments.videoId),
                ),
            )
            .where(whereClause)

        const assigned = Number(statsRow?.assigned ?? totalRow?.total ?? 0)
        const completedCount = Number(statsRow?.completed ?? 0)
        const inProgress = Number(statsRow?.inProgress ?? 0)

        const [continueAssignment] = await this.db
            .select(baseSelect)
            .from(assignments)
            .innerJoin(videos, eq(videos.id, assignments.videoId))
            .leftJoin(
                watchProgress,
                and(
                    eq(watchProgress.tenantId, assignments.tenantId),
                    eq(watchProgress.userId, assignments.userId),
                    eq(watchProgress.videoId, assignments.videoId),
                ),
            )
            .leftJoin(
                completions,
                and(
                    eq(completions.tenantId, assignments.tenantId),
                    eq(completions.userId, assignments.userId),
                    eq(completions.videoId, assignments.videoId),
                ),
            )
            .where(and(whereClause, sql`${completions.id} is null`))
            .orderBy(
                desc(sql`coalesce(${watchProgress.percent}, 0)`),
                desc(assignments.id),
            )
            .limit(1)

        return {
            ...toPageResult(items, assigned, params),
            stats: {
                assigned,
                inProgress,
                completed: completedCount,
                notStarted: Math.max(0, assigned - inProgress - completedCount),
            },
            continueAssignment: continueAssignment ?? null,
        }
    }

    async listLearners(
        tenantId: number,
        params: PageParams,
    ): Promise<PageResult<LearnerOption>> {
        const whereClause = and(
            eq(tenantMemberships.tenantId, tenantId),
            eq(tenantMemberships.role, 'learner'),
        )

        const [totalRow] = await this.db
            .select({ total: count() })
            .from(tenantMemberships)
            .where(whereClause)

        const items = await this.db
            .select({
                userId: users.id,
                email: users.email,
                name: users.name,
            })
            .from(tenantMemberships)
            .innerJoin(users, eq(users.id, tenantMemberships.userId))
            .where(whereClause)
            .orderBy(sql`lower(${users.name})`)
            .limit(params.pageSize)
            .offset(pageOffset(params))

        return toPageResult(items, Number(totalRow?.total ?? 0), params)
    }

    async delete(assignmentId: number, tenantId: number) {
        const [deleted] = await this.db
            .delete(assignments)
            .where(
                and(
                    eq(assignments.id, assignmentId),
                    eq(assignments.tenantId, tenantId),
                ),
            )
            .returning()

        if (!deleted) throw new NotFoundException()
        return deleted
    }

    async assertAssigned(tenantId: number, userId: number, videoId: number) {
        const [row] = await this.db
            .select({ id: assignments.id })
            .from(assignments)
            .where(
                and(
                    eq(assignments.tenantId, tenantId),
                    eq(assignments.userId, userId),
                    eq(assignments.videoId, videoId),
                ),
            )
            .limit(1)

        if (!row) throw new ForbiddenException('Not assigned to this video')
        return row
    }

    private async assertVideoInTenant(videoId: number, tenantId: number) {
        const [video] = await this.db
            .select({
                id: videos.id,
                title: videos.title,
                publishState: videos.publishState,
            })
            .from(videos)
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .limit(1)

        if (!video) throw new NotFoundException('Video not found')

        if (video.publishState !== 'published') {
            throw new BadRequestException('Video must be published to assign')
        }

        return video
    }

    private async assertLearnerInTenant(userId: number, tenantId: number) {
        const [membership] = await this.db
            .select({ id: tenantMemberships.id })
            .from(tenantMemberships)
            .where(
                and(
                    eq(tenantMemberships.userId, userId),
                    eq(tenantMemberships.tenantId, tenantId),
                    eq(tenantMemberships.role, 'learner'),
                ),
            )
            .limit(1)

        if (!membership) {
            throw new BadRequestException(
                'Assignee must be a learner in this tenant',
            )
        }
    }
}
