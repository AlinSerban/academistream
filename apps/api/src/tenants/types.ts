export interface Tenant {
    id: number,
    name: string,
    status: string
}

export interface CreateTenantInput {
    tenantName: string;
    adminEmail: string;
    adminName: string;
    adminPassword: string;
}