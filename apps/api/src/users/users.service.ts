import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class UsersService {
    constructor(@Inject(DRIZZLE) private readonly db: Db) { }

    async findUser(email: string) {
        const user = await this.db.select().from(users).where(eq(users.email, email)
        ).limit(1)

        return user[0];

    }

}
