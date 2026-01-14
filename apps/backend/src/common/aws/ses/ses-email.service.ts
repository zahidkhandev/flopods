import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
  VerifyEmailIdentityCommand,
  GetSendQuotaCommand,
  ListVerifiedEmailAddressesCommand,
} from '@aws-sdk/client-ses';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  from?: string;
  replyTo?: string[];
  cc?: string[];
  bcc?: string[];
}

@Injectable()
export class AwsSesEmailService {
  private readonly logger = new Logger(AwsSesEmailService.name);
  private readonly sesClient: SESClient | null = null;
  private readonly defaultFromEmail: string;
  private readonly isEnabled: boolean;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_SES_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SES_SECRET_ACCESS_KEY');
    this.defaultFromEmail = this.configService.get<string>('AWS_SES_NO_REPLY_EMAIL') || '';

    this.isEnabled = !!(this.region && accessKeyId && secretAccessKey);

    if (this.isEnabled && accessKeyId && secretAccessKey) {
      this.sesClient = new SESClient({
        region: this.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        maxAttempts: 3,
      });
      this.logger.log('AWS SES initialized successfully');
    } else {
      this.logger.warn('⚠️  AWS SES not configured - emails will be logged only');
    }
  }

  /**
   * Send a single email
   */
  async sendEmail(options: SendEmailOptions): Promise<{ messageId: string }> {
    const { to, subject, bodyHtml, bodyText, from, replyTo, cc, bcc } = options;

    if (!this.defaultFromEmail && !from) {
      throw new InternalServerErrorException('SES "from" email is not configured.');
    }

    const source = from || `Flopods <${this.defaultFromEmail}>`;
    const toAddresses = Array.isArray(to) ? to : [to];

    // Development mode - log only
    if (!this.isEnabled || !this.sesClient) {
      this.logger.log('=== EMAIL LOG (Development Mode) ===');
      this.logger.log(`From: ${source}`);
      this.logger.log(`To: ${toAddresses.join(', ')}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Body: ${bodyText || 'HTML content'}`);
      if (cc) this.logger.log(`CC: ${cc.join(', ')}`);
      if (bcc) this.logger.log(`BCC: ${bcc.join(', ')}`);
      this.logger.log('===================================');
      return { messageId: `dev-mode-${Date.now()}` };
    }

    const params: SendEmailCommandInput = {
      Source: source,
      Destination: {
        ToAddresses: toAddresses,
        ...(cc && cc.length > 0 && { CcAddresses: cc }),
        ...(bcc && bcc.length > 0 && { BccAddresses: bcc }),
      },
      ...(replyTo && replyTo.length > 0 && { ReplyToAddresses: replyTo }),
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: bodyHtml, Charset: 'UTF-8' },
          ...(bodyText && { Text: { Data: bodyText, Charset: 'UTF-8' } }),
        },
      },
    };

    try {
      this.logger.log(`📧 Sending email to: ${toAddresses.join(', ')}`);
      const command = new SendEmailCommand(params);
      const response = await this.sesClient.send(command);
      this.logger.log(`Email sent successfully. Message ID: ${response.MessageId}`);
      return { messageId: response.MessageId || '' };
    } catch (error: any) {
      this.logger.error('❌ SES send email error:', error);
      throw new InternalServerErrorException(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send bulk emails by sending individual emails (simple approach)
   * For production with high volume, use SES SendBulkTemplatedEmail with pre-created templates
   */
  async sendBulkEmails(
    recipients: string[],
    subject: string,
    bodyHtml: string,
    bodyText?: string,
  ): Promise<{ successCount: number; failureCount: number; errors: string[] }> {
    if (!this.isEnabled || !this.sesClient) {
      this.logger.warn('Bulk email skipped - SES not configured');
      return { successCount: 0, failureCount: recipients.length, errors: [] };
    }

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // Send emails in batches to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const promises = batch.map(async (recipient) => {
        try {
          await this.sendEmail({
            to: recipient,
            subject,
            bodyHtml,
            bodyText,
          });
          successCount++;
        } catch (error: any) {
          failureCount++;
          errors.push(`${recipient}: ${error.message}`);
        }
      });

      await Promise.all(promises);

      // Rate limiting - wait between batches
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.log(`📧 Bulk email completed: ${successCount} success, ${failureCount} failures`);
    return { successCount, failureCount, errors };
  }

  /**
   * Verify email identity (required before sending from that address)
   */
  async verifyEmailIdentity(email: string): Promise<void> {
    if (!this.isEnabled || !this.sesClient) {
      this.logger.warn(`Email verification skipped - SES not configured: ${email}`);
      return;
    }

    try {
      const command = new VerifyEmailIdentityCommand({ EmailAddress: email });
      await this.sesClient.send(command);
      this.logger.log(`Verification email sent to: ${email}`);
    } catch (error: any) {
      this.logger.error('❌ SES verify email error:', error);
      throw new InternalServerErrorException(`Failed to verify email: ${error.message}`);
    }
  }

  /**
   * Get SES send quota (how many emails can be sent)
   */
  async getSendQuota(): Promise<{
    max24HourSend: number;
    maxSendRate: number;
    sentLast24Hours: number;
  }> {
    if (!this.isEnabled || !this.sesClient) {
      throw new InternalServerErrorException('SES not configured');
    }

    try {
      const command = new GetSendQuotaCommand({});
      const response = await this.sesClient.send(command);

      return {
        max24HourSend: response.Max24HourSend || 0,
        maxSendRate: response.MaxSendRate || 0,
        sentLast24Hours: response.SentLast24Hours || 0,
      };
    } catch (error: any) {
      this.logger.error('❌ SES get send quota error:', error);
      throw new InternalServerErrorException(`Failed to get send quota: ${error.message}`);
    }
  }

  /**
   * List verified email addresses
   */
  async listVerifiedEmails(): Promise<string[]> {
    if (!this.isEnabled || !this.sesClient) {
      throw new InternalServerErrorException('SES not configured');
    }

    try {
      const command = new ListVerifiedEmailAddressesCommand({});
      const response = await this.sesClient.send(command);
      return response.VerifiedEmailAddresses || [];
    } catch (error: any) {
      this.logger.error('❌ SES list verified emails error:', error);
      throw new InternalServerErrorException(`Failed to list verified emails: ${error.message}`);
    }
  }

  /**
   * Send email with retry logic
   */
  async sendEmailWithRetry(
    options: SendEmailOptions,
    maxRetries: number = 3,
  ): Promise<{ messageId: string }> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.sendEmail(options);
      } catch (error: any) {
        lastError = error;
        this.logger.warn(`Email send attempt ${attempt}/${maxRetries} failed: ${error.message}`);

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sanitize email list (remove invalid emails)
   */
  sanitizeEmailList(emails: string[]): string[] {
    return emails.filter((email) => this.validateEmail(email));
  }

  /**
   * Check if SES is properly configured
   */
  isConfigured(): boolean {
    return this.isEnabled;
  }

  /**
   * Get SES configuration info
   */
  getConfig() {
    return {
      isEnabled: this.isEnabled,
      region: this.region,
      defaultFrom: this.defaultFromEmail,
    };
  }
}
