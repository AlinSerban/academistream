export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
}

export interface Membership {
  tenantId: number
  role: string
}

export interface MeResponse {
  id: number
  name: string
  email: string
  isPlatformAdmin: boolean
  memberships: Membership[]
}

export interface MessageResponse {
  message: string
}

export interface AuthTokens {
  accessToken: string | null
}
