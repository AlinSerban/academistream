import { Module } from '@nestjs/common'
import { DbModule } from '../db/db.module'
import { AssignmentsController } from './assignments.controller'
import { AssignmentsService } from './assignments.service'
import { ProgressController } from './progress.controller'
import { ProgressService } from './progress.service'

@Module({
    imports: [DbModule],
    controllers: [AssignmentsController, ProgressController],
    providers: [AssignmentsService, ProgressService],
    exports: [AssignmentsService, ProgressService],
})
export class TrainingModule { }
