import { Module } from '@nestjs/common'
import { DbModule } from '../db/db.module'
import { MailModule } from '../mail/mail.module'
import { NotificationsService } from './notifications.service'

@Module({
    imports: [DbModule, MailModule],
    providers: [NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule { }
