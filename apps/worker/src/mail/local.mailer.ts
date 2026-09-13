import { Injectable, Logger } from '@nestjs/common'
import type { MailService, SendMailInput } from './mail.types'

/** Local/console mailer. Production SES can replace this behind the same MAIL token. */
@Injectable()
export class LocalMailerService implements MailService {
    private readonly logger = new Logger(LocalMailerService.name)

    async send(input: SendMailInput): Promise<void> {
        this.logger.log(
            `[local mailer] to=${input.to} subject=${input.subject} body=${input.body}`,
        )
    }
}
