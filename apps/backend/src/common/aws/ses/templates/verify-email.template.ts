import { baseEmailTemplate } from './base.template';

export const verifyEmailTemplate = (name: string, verificationUrl: string): string => {
  const content = `
    <h2>Welcome to Actopod, ${name}!</h2>
    <p>Thank you for signing up. Please verify your email address to get started with our AI Workflow Canvas.</p>

    <p style="text-align: center;">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </p>

    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #6b7280; background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px;">
      ${verificationUrl}
    </p>

    <div style="margin-top: 20px; padding: 15px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 6px;">
      <p style="margin: 0; font-size: 14px; color: #92400E;">
        ⏰ This verification link will expire in <strong>24 hours</strong>.
      </p>
    </div>

    <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
      If you didn't create an account with Actopod, you can safely ignore this email.
    </p>
  `;
  return baseEmailTemplate(content);
};
