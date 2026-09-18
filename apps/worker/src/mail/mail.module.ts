import { Module } from '@nestjs/common'
import { LocalMailerService } from '@academistream/shared'

export const MAIL = Symbol('MAIL')

@Module({
    providers: [
        LocalMailerService,
        {
            provide: MAIL,
            useExisting: LocalMailerService,
        },
    ],
    exports: [MAIL],
})
export class MailModule { }
