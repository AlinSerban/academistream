export interface SendMailInput {
    to: string
    subject: string
    body: string
}

export interface MailService {
    send(input: SendMailInput): Promise<void>
}
