export type Notification = {
  id: number
  tenantId: number
  userId: number
  type: string
  title: string | null
  body: string | null
  readAt: string | null
  createdAt: string
}
