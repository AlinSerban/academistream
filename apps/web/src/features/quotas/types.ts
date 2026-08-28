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
