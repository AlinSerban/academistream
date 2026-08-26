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
    tenantMemberships,
    users,
    videos,
} from '@academistream/db'
import { and, eq } from 'drizzle-orm'
import { DRIZZLE } from '../db/db.module'
import type { CreateAssignmentInput } from './types'
import { AuditService } from '../audit/audit.service'

@Injectable()
export class AssignmentsService {
    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        private readonly audit: AuditService,
    ) { }

    async create(
        tenantId: number,
        assignedByUserId: number,
        input: CreateAssignmentInput,
    ) {
        await this.assertVideoInTenant(input.videoId, tenantId)
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

        return created
    }

    async listForTenant(tenantId: number) {
        return this.db
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
            .where(eq(assignments.tenantId, tenantId))
    }

    async listMine(tenantId: number, userId: number) {
        return this.db
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
            .where(
                and(
                    eq(assignments.tenantId, tenantId),
                    eq(assignments.userId, userId),
                ),
            )
    }

    async listLearners(tenantId: number) {
        return this.db
            .select({
                userId: users.id,
                email: users.email,
                name: users.name,
            })
            .from(tenantMemberships)
            .innerJoin(users, eq(users.id, tenantMemberships.userId))
            .where(
                and(
                    eq(tenantMemberships.tenantId, tenantId),
                    eq(tenantMemberships.role, 'learner'),
                ),
            )
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

    async assertAssigned(
        tenantId: number,
        userId: number,
        videoId: number,
    ) {
        const [row] = await this.db
            .select()
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
            .select()
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
            .select()
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
