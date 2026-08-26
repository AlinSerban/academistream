import { Module } from '@nestjs/common'
import { DbModule } from '../db/db.module'
import { AuditController } from './audit.controller'
import { AuditService } from './audit.service'

@Module({
    imports: [DbModule],
    controllers: [AuditController],
    providers: [AuditService],
    exports: [AuditService],
})
export class AuditModule { }
