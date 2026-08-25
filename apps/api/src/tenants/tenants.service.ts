import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DRIZZLE } from "../db/db.module";
import type { Db } from '@academistream/db';
import type { CreateTenantInput } from "./types";
import { tenantMemberships, tenants, users } from "@academistream/db";
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

@Injectable()
export class TenantsService {
    constructor(@Inject(DRIZZLE) private readonly db: Db) { }

    async create(input: CreateTenantInput) {
        await this.assertTenantNameAvailable(input.tenantName);
        await this.assertEmailAvailable(input.adminEmail);

        const passwordHash = await bcrypt.hash(input.adminPassword, 10)
        const [tenant] = await this.insertTenant(input.tenantName);
        const [user] = await this.insertAdminUser(input, passwordHash);

        await this.insertMembership(user.id, tenant.id);

        return { tenant, admin: { id: user.id, email: user.email } };

    }

    async getMe(tenantId: number) {
        const [tenant] = await this.getTenantById(tenantId);

        if (!tenant) throw new NotFoundException();

        return {
            id: tenant.id,
            name: tenant.name,
            status: tenant.status
        }

    }

    private async getTenantById(tenantId: number) {
        return await this.db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    }

    private async assertTenantNameAvailable(name: string) {
        const checkDuplicateTenant = await this.db.select().from(tenants).where(eq(tenants.name, name));

        if (checkDuplicateTenant.length > 0)
            throw new ConflictException();
    }

    private async assertEmailAvailable(email: string) {
        const checkDuplicateUser = await this.db.select().from(users).where(eq(users.email, email));

        if (checkDuplicateUser.length > 0)
            throw new ConflictException();
    }

    private async insertTenant(name: string) {
        return await this.db.insert(tenants).values({ name: name }).returning();
    }

    private async insertAdminUser(input: CreateTenantInput, passwordHash: string) {
        return await this.db.insert(users).values({
            email: input.adminEmail,
            name: input.adminName,
            passwordHash,
            isPlatformAdmin: false
        }).returning()
    }

    private async insertMembership(userId: number, tenantId: number) {
        await this.db.insert(tenantMemberships).values({
            userId: userId,
            tenantId: tenantId,
            role: 'tenant_admin'
        })
    }
}