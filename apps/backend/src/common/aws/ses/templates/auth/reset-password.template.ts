import { baseEmailTemplate } from '../base.template';

export const resetPasswordTemplate = (name: string, resetUrl: string): string => {
  const content = `
    <h2>Reset Your Password</h2>
    <p>Hi ${name},</p>
    <p>We received a request to reset your password for your Actopod account.</p>

    <p style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>

    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #6b7280; background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px;">
      ${resetUrl}
    </p>

    <div style="margin-top: 20px; padding: 15px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 6px;">
      <p style="margin: 0; font-size: 14px; color: #92400E;">
        ⏰ This password reset link will expire in <strong>1 hour</strong>.
      </p>
    </div>

    <div style="margin-top: 20px; padding: 15px; background-color: #FEF2F2; border-left: 4px solid #EF4444; border-radius: 6px;">
      <p style="margin: 0; font-size: 14px; color: #991B1B;">
        <strong>⚠️ Security Warning:</strong><br>
        If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
      </p>
    </div>
  `;
  return baseEmailTemplate(content);
};
