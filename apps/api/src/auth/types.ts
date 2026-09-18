export interface JwtRole {
    tenantId: number;
    role: string;
}

export interface JwtPayload {
    sub: number;
    username: string;
    isPlatformAdmin: boolean;
    roles: JwtRole[];
    iat?: number;
    exp?: number;
}

export interface SignInDto {
    email: string;
    password: string;
}

export interface AccessTokenResponse {
    access_token: string;
}

export interface SignOutResponse {
    message: string;
}

export interface MeResponse {
    id: number;
    name: string;
    email: string;
    isPlatformAdmin: boolean;
    memberships: JwtRole[];
}
