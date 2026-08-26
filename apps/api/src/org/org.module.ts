import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { DbModule } from '../db/db.module'
import { CompletionsExportService } from './completions-export.service'
import { ExportsController } from './exports.controller'
import { InvitesController } from './invites.controller'
import { InvitesService } from './invites.service'
import { MembersController } from './members.controller'
import { MembersService } from './members.service'

@Module({
    imports: [DbModule, AuditModule],
    controllers: [InvitesController, MembersController, ExportsController],
    providers: [InvitesService, MembersService, CompletionsExportService],
    exports: [InvitesService, MembersService],
})
export class OrgModule { }
