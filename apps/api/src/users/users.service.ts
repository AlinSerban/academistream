import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import type { Db } from '@academistream/db';
import { tenantMemberships, users } from '@academistream/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class UsersService {
    constructor(@Inject(DRIZZLE) private readonly db: Db) { }

    async findUser(email: string) {
        const user = await this.db.select().from(users).where(eq(users.email, email)
        ).limit(1)

        return user[0];

    }

    async findUserById(id: number) {
        const user = await this.db.select().from(users).where(eq(users.id, id)
        ).limit(1)

        return user[0];
    }

    async findMembershipsByUserId(id: number) {
        const memberships = await this.db.select({
            tenantId: tenantMemberships.tenantId,
            role: tenantMemberships.role
        }).from(tenantMemberships).where(eq(tenantMemberships.userId, id))

        return memberships;
    }

}
