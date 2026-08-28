import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env']
    }),
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
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule { }
