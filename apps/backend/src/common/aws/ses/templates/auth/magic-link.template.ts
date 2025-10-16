import { baseEmailTemplate } from '../base.template';

export const magicLinkTemplate = (
  name: string,
  magicUrl: string,
  expiresIn: string,
  ipAddress: string,
  deviceName: string,
): string => {
  const content = `
    <h2>🔐 Sign in to Actopod</h2>
    <p>Hi ${name || 'there'},</p>
    <p>Click the button below to securely sign in to your Actopod account:</p>
    <p style="text-align: center;">
      <a href="${magicUrl}" class="button">Sign In to Actopod</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #6b7280; background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px;">
      ${magicUrl}
    </p>

    <div style="margin-top: 30px; padding: 20px; background-color: #EEF2FF; border-left: 4px solid #4F46E5; border-radius: 6px;">
      <p style="margin: 0 0 10px 0; font-weight: 600; color: #4338CA;">🔒 Security Information</p>
      <p style="margin: 5px 0; font-size: 14px; color: #4338CA;">• This link expires in <strong>${expiresIn}</strong></p>
      <p style="margin: 5px 0; font-size: 14px; color: #4338CA;">• Device: ${deviceName}</p>
      <p style="margin: 5px 0; font-size: 14px; color: #4338CA;">• IP Address: ${ipAddress}</p>
      <p style="margin: 5px 0; font-size: 14px; color: #4338CA;">• Can only be used once</p>
    </div>

    <div style="margin-top: 20px; padding: 15px; background-color: #FEF2F2; border-left: 4px solid #EF4444; border-radius: 6px;">
      <p style="margin: 0; font-size: 14px; color: #991B1B;">
        <strong>⚠️ Security Warning:</strong><br>
        If you didn't request this sign-in link, please ignore this email or contact our support team immediately at <a href="mailto:${process.env.AWS_SES_SUPPORT_EMAIL || 'support@actopod.dev'}">${process.env.AWS_SES_SUPPORT_EMAIL || 'support@actopod.dev'}</a>
      </p>
    </div>
  `;
  return baseEmailTemplate(content);
};
