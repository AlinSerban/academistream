import { Injectable, Logger } from '@nestjs/common'
import type { MailService, SendMailInput } from './mail.types'

@Injectable()
export class LocalMailerService implements MailService {
    private readonly logger = new Logger(LocalMailerService.name)

    async send(input: SendMailInput): Promise<void> {
        this.logger.log(
            `[mail stub] to=${input.to} subject=${input.subject} body=${input.body}`,
        )

        /*
         * Future SES (do not enable until domain is verified):
         * const ses = new SESClient({ region: process.env.AWS_REGION });
         * await ses.send(new SendEmailCommand({ ... }));
         */
    }
}
