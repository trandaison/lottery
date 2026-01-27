import sgMail from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '@/config/env';
import { ticketImageService } from './ticket-image.service';
import type { Order } from '@/db/schema/orders';
import type { User } from '@/db/schema/users';
import type { Campaign } from '@/db/schema/campaigns';
import type { Ticket } from '@/db/schema/tickets';
import { generateEmailTemplate } from './email-template';

/**
 * Email Service
 *
 * Handles email sending with support for multiple providers:
 * - Local/Dev/Test: MailHog via Nodemailer (SMTP)
 * - Production: SendGrid
 *
 * Features:
 * - Ticket purchase confirmation emails
 * - Ticket image attachments
 * - Retry logic (3 attempts)
 * - Error logging
 * - Automatic provider selection based on environment
 *
 * Architecture Principles:
 * - Single responsibility: Only handles email sending
 * - Clean code: Simple, focused methods
 * - Retry mechanism: 3 attempts with exponential backoff
 * - Environment-aware: Automatically selects appropriate provider
 */
export class EmailService {
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // 1 second base delay
  private readonly useSendGrid: boolean;
  private readonly transporter: Transporter | null = null;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor() {
    if (!env) {
      throw new Error('Environment variables not configured');
    }

    // Determine email provider based on environment
    const isProduction = env.NODE_ENV === 'production';
    const hasSendGridKey = !!env.SENDGRID_API_KEY;

    // Use SendGrid in production if API key is available, otherwise use MailHog
    this.useSendGrid = isProduction && hasSendGridKey;

    // Set from email/name
    this.fromEmail = env.EMAIL_FROM || 'noreply@lottery.com';
    this.fromName = env.EMAIL_FROM_NAME || 'Lottery System';

    if (this.useSendGrid) {
      // Initialize SendGrid
      if (!env.SENDGRID_API_KEY) {
        console.warn('[EmailService] SENDGRID_API_KEY not set, falling back to SMTP');
      } else {
        sgMail.setApiKey(env.SENDGRID_API_KEY);
        console.log('[EmailService] Using SendGrid for email delivery');
      }
    } else {
      // Initialize Nodemailer for MailHog (local/dev/test)
      const smtpHost = env.SMTP_HOST || 'localhost';
      const smtpPort = parseInt(env.SMTP_PORT || '1025', 10);
      const smtpUser = env.SMTP_USER;
      const smtpPass = env.SMTP_PASS;

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false, // MailHog doesn't use TLS
        auth: smtpUser && smtpPass
          ? {
              user: smtpUser,
              pass: smtpPass,
            }
          : undefined,
        // Ignore certificate errors for local development
        tls: {
          rejectUnauthorized: false,
        },
      });

      console.log(
        `[EmailService] Using MailHog (SMTP) for email delivery: ${smtpHost}:${smtpPort}`
      );
    }
  }

  /**
   * Send ticket purchase confirmation email
   *
   * @param order - Order object
   * @param user - User object
   * @param campaign - Campaign object
   * @param tickets - Array of ticket objects
   * @returns true if sent successfully, false otherwise
   */
  async sendTicketEmail(
    order: Order,
    user: User,
    campaign: Campaign,
    tickets: Ticket[]
  ): Promise<boolean> {
    try {
      // Generate ticket images
      console.log(`[EmailService] Generating ${tickets.length} ticket images...`);
      const ticketImages = await ticketImageService.generateTicketImages(
        tickets.map((t) => ({ ticketNumber: t.ticketNumber })),
        { title: campaign.title }
      );

      // Generate email HTML
      const htmlContent = generateEmailTemplate({
        userName: user.name,
        campaignTitle: campaign.title,
        orderReference: order.paymentReferenceId,
        ticketsCount: tickets.length,
        totalAmount: order.totalAmount,
        ticketNumbers: tickets.map((t) => t.ticketNumber),
      });

      const subject = `Xác nhận mua vé - ${campaign.title}`;

      if (this.useSendGrid) {
        return await this.sendWithSendGrid(
          user.email,
          subject,
          htmlContent,
          ticketImages,
          tickets
        );
      } else {
        return await this.sendWithNodemailer(
          user.email,
          subject,
          htmlContent,
          ticketImages,
          tickets
        );
      }
    } catch (error) {
      console.error('[EmailService] Error sending ticket email:', error);
      return false;
    }
  }

  /**
   * Send email using SendGrid
   */
  private async sendWithSendGrid(
    to: string,
    subject: string,
    html: string,
    ticketImages: Buffer[],
    tickets: Ticket[]
  ): Promise<boolean> {
    if (!env || !env.SENDGRID_API_KEY) {
      console.error('[EmailService] Cannot send email: SENDGRID_API_KEY not configured');
      return false;
    }

    // Prepare email attachments for SendGrid
    const attachments = ticketImages.map((imageBuffer, index) => ({
      content: imageBuffer.toString('base64'),
      filename: `ticket-${tickets[index].ticketNumber}.png`,
      type: 'image/png',
      disposition: 'attachment',
    }));

    // Prepare email message
    const msg = {
      to,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject,
      html,
      attachments,
    };

    return await this.sendWithRetry(() => sgMail.send(msg));
  }

  /**
   * Send email using Nodemailer (MailHog)
   */
  private async sendWithNodemailer(
    to: string,
    subject: string,
    html: string,
    ticketImages: Buffer[],
    tickets: Ticket[]
  ): Promise<boolean> {
    if (!this.transporter) {
      console.error('[EmailService] Cannot send email: SMTP transporter not configured');
      return false;
    }

    // Prepare email attachments for Nodemailer
    const attachments = ticketImages.map((imageBuffer, index) => ({
      filename: `ticket-${tickets[index].ticketNumber}.png`,
      content: imageBuffer,
      contentType: 'image/png',
    }));

    const mailOptions = {
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to,
      subject,
      html,
      attachments,
    };

    return await this.sendWithRetry(() => this.transporter!.sendMail(mailOptions));
  }

  /**
   * Send email with retry logic (3 attempts)
   *
   * @param sendFn - Function that sends the email
   * @returns true if sent successfully, false otherwise
   */
  private async sendWithRetry(sendFn: () => Promise<any>): Promise<boolean> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[EmailService] Sending email (attempt ${attempt}/${this.maxRetries})...`);
        await sendFn();
        console.log(`[EmailService] Email sent successfully`);
        return true;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `[EmailService] Attempt ${attempt} failed:`,
          lastError.message
        );

        // If not the last attempt, wait before retrying
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[EmailService] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    console.error(
      `[EmailService] Failed to send email after ${this.maxRetries} attempts:`,
      lastError
    );
    return false;
  }

  /**
   * Test email sending (for development/testing)
   */
  async testEmail(to: string): Promise<boolean> {
    const subject = 'Test Email - Lottery System';
    const html = '<p>This is a test email from the Lottery System.</p>';

    if (this.useSendGrid) {
      if (!env || !env.SENDGRID_API_KEY) {
        console.error('[EmailService] Cannot send test email: SENDGRID_API_KEY not configured');
        return false;
      }

      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        html,
      };

      return await this.sendWithRetry(() => sgMail.send(msg));
    } else {
      if (!this.transporter) {
        console.error('[EmailService] Cannot send test email: SMTP transporter not configured');
        return false;
      }

      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to,
        subject,
        html,
      };

      return await this.sendWithRetry(() => this.transporter!.sendMail(mailOptions));
    }
  }

  /**
   * Verify email configuration
   */
  async verifyConnection(): Promise<boolean> {
    if (this.useSendGrid) {
      // SendGrid doesn't have a verify method, so we'll just check if API key exists
      if (!env) {
        return false;
      }
      return !!env.SENDGRID_API_KEY;
    } else {
      if (!this.transporter) {
        return false;
      }

      try {
        await this.transporter.verify();
        console.log('[EmailService] SMTP connection verified');
        return true;
      } catch (error) {
        console.error('[EmailService] SMTP verification failed:', error);
        return false;
      }
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
