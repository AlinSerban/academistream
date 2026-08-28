import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import type { Db } from '@academistream/db'
import { tenantMemberships, tenants, videos } from '@academistream/db'
import { count, eq } from 'drizzle-orm'
import { DRIZZLE } from '../db/db.module'
import type { TenantQuotaStatus, UpdateQuotasInput } from './types'

@Injectable()
export class QuotasService {
    constructor(@Inject(DRIZZLE) private readonly db: Db) { }

    /**
     * Null maxUsers / maxVideos on the tenant row means unlimited (no enforcement).
     */
    async assertCanAddMember(tenantId: number): Promise<void> {
        const limits = await this.getTenantLimits(tenantId)
        if (limits.maxUsers == null) return

        const members = await this.countMembers(tenantId)
        if (members >= limits.maxUsers) {
            throw new BadRequestException('Tenant user limit reached')
        }
    }

    /** Enforced at video create (one DB row per library video). */
    async assertCanAddVideo(tenantId: number): Promise<void> {
        const limits = await this.getTenantLimits(tenantId)
        if (limits.maxVideos == null) return

        const videoCount = await this.countVideos(tenantId)
        if (videoCount >= limits.maxVideos) {
            throw new BadRequestException('Tenant video limit reached')
        }
    }

    async getStatusForTenant(tenantId: number): Promise<TenantQuotaStatus> {
        const limits = await this.getTenantLimits(tenantId)
        const [members, videoCount] = await Promise.all([
            this.countMembers(tenantId),
            this.countVideos(tenantId),
        ])

        return {
            tenantId,
            limits,
            usage: {
                members,
                videos: videoCount,
            },
        }
    }

    async updateLimits(tenantId: number, input: UpdateQuotasInput) {
        await this.assertTenantExists(tenantId)

        const patch: {
            maxUsers?: number | null
            maxVideos?: number | null
            updatedAt: Date
        } = { updatedAt: new Date() }

        if (input.maxUsers !== undefined) {
            this.assertNonNegativeLimit(input.maxUsers, 'maxUsers')
            patch.maxUsers = input.maxUsers
        }
        if (input.maxVideos !== undefined) {
            this.assertNonNegativeLimit(input.maxVideos, 'maxVideos')
            patch.maxVideos = input.maxVideos
        }

        const [updated] = await this.db
            .update(tenants)
            .set(patch)
            .where(eq(tenants.id, tenantId))
            .returning()

        if (!updated) throw new NotFoundException()
        return updated
    }

    private async getTenantLimits(tenantId: number) {
        const [tenant] = await this.db
            .select({
                maxUsers: tenants.maxUsers,
                maxVideos: tenants.maxVideos,
            })
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .limit(1)

        if (!tenant) throw new NotFoundException('Tenant not found')

        return {
            maxUsers: tenant.maxUsers,
            maxVideos: tenant.maxVideos,
        }
    }

    private async countMembers(tenantId: number): Promise<number> {
        const [row] = await this.db
            .select({ value: count() })
            .from(tenantMemberships)
            .where(eq(tenantMemberships.tenantId, tenantId))
        return Number(row?.value ?? 0)
    }

    private async countVideos(tenantId: number): Promise<number> {
        const [row] = await this.db
            .select({ value: count() })
            .from(videos)
            .where(eq(videos.tenantId, tenantId))
        return Number(row?.value ?? 0)
    }

    private async assertTenantExists(tenantId: number) {
        const [tenant] = await this.db
            .select({ id: tenants.id })
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .limit(1)
        if (!tenant) throw new NotFoundException('Tenant not found')
    }

    private assertNonNegativeLimit(
        value: number | null,
        field: string,
    ): void {
        if (value == null) return
        if (!Number.isInteger(value) || value < 0) {
            throw new BadRequestException(`${field} must be a non-negative integer or null`)
        }
    }
}
