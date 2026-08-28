import { Module } from '@nestjs/common'
import { DbModule } from '../db/db.module'
import { QuotasController } from './quotas.controller'
import { QuotasService } from './quotas.service'

@Module({
    imports: [DbModule],
    controllers: [QuotasController],
    providers: [QuotasService],
    exports: [QuotasService],
})
export class QuotasModule { }
