import { WorkspaceRole } from '@flopods/schema';

export const workspaceInvitationTemplate = (
  workspaceName: string,
  inviteLink: string,
  role: WorkspaceRole,
): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workspace Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Workspace Invitation</h1>
    </div>

    <div style="padding: 40px;">
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 20px;">
        You've been invited to join <strong>${workspaceName}</strong> as a <strong>${role}</strong> on Flopods.
      </p>

      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 30px;">
        Click the button below to accept the invitation and start collaborating:
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Accept Invitation
        </a>
      </div>

      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 30px 0 0; padding-top: 20px; border-top: 1px solid #eee;">
        This invitation will expire in <strong>7 days</strong>.
      </p>

      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 10px 0 0;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>

    <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #eee;">
      <p style="margin: 0; font-size: 12px; color: #999;">
        © ${new Date().getFullYear()} Flopods. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
};
