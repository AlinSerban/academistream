export type UpdateQuotasInput = {
    /** Null = unlimited seats. */
    maxUsers?: number | null
    /** Null = unlimited videos. */
    maxVideos?: number | null
}

export type TenantQuotaStatus = {
    tenantId: number
    limits: {
        maxUsers: number | null
        maxVideos: number | null
    }
    usage: {
        members: number
        videos: number
    }
}
