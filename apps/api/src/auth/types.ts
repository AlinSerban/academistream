export interface JwtPayload {
    sub: number;
    username: string;
    isPlatformAdmin: boolean;
    roles: { tenantId: number; role: string }[];
    iat?: number;
    exp?: number;
}