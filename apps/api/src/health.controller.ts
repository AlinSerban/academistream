import { Controller, Get, Inject } from '@nestjs/common';
import { DRIZZLE } from './db/db.module';
import { sql } from 'drizzle-orm'
import type { Db } from './db/client'

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) { }

  @Get()
  async check() {
    await this.db.execute(sql`select 1`);
    return { status: 'ok', service: 'api', db: 'up' };
  }
}
