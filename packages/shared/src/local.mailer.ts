import { Injectable, Logger } from '@nestjs/common';
import type { MailService, SendMailInput } from './mail.types.js';

/** Console mailer for local/demo. Swap SES behind the same MAIL token in production. */
@Injectable()
export class LocalMailerService implements MailService {
  private readonly logger = new Logger(LocalMailerService.name);

  async send(input: SendMailInput): Promise<void> {
    this.logger.log(
      `[local mailer] to=${input.to} subject=${input.subject} body=${input.body}`,
    );
  }
}
