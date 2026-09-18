import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DbModule } from './db/db.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { ContentModule } from './content/content.module';
import { StorageModule } from './storage/storage.module';
import { TrainingModule } from './training/training.module';
import { AuditModule } from './audit/audit.module';
import { OrgModule } from './org/org.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QuotasModule } from './quotas/quotas.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env']
    }),
    RedisModule,
    DbModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    ContentModule,
    StorageModule,
    TrainingModule,
    AuditModule,
    OrgModule,
    NotificationsModule,
    QuotasModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }
