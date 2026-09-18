import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import type { Db } from '@academistream/db';
import { tenantMemberships, users } from '@academistream/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class UsersService {
    constructor(@Inject(DRIZZLE) private readonly db: Db) { }

    async findUser(email: string) {
        const [user] = await this.db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                passwordHash: users.passwordHash,
                isPlatformAdmin: users.isPlatformAdmin,
            })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        return user;
    }

    async findUserById(id: number) {
        const [user] = await this.db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                isPlatformAdmin: users.isPlatformAdmin,
            })
            .from(users)
            .where(eq(users.id, id))
            .limit(1);

        return user;
    }

    async findMembershipsByUserId(id: number) {
        return this.db
            .select({
                tenantId: tenantMemberships.tenantId,
                role: tenantMemberships.role,
            })
            .from(tenantMemberships)
            .where(eq(tenantMemberships.userId, id));
    }
}
