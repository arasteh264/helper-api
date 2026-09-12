import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { EmailSender } from '../../domain/services/email-sender.port';

@Injectable()
export class NodemailerEmailSender implements EmailSender {
  private readonly logger = new Logger(NodemailerEmailSender.name);
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`Sending email to ${to} | Subject: ${subject}`);

    try {
      await this.transporter.sendMail({
        from: `"Helper" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html: body,
      });
      this.logger.log(`✅ Email successfully sent to ${to}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${to}`, error);
      throw error;
    }
  }
}
