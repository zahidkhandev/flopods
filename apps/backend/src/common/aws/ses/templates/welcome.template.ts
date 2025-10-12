import { baseEmailTemplate } from './base.template';

export const welcomeEmailTemplate = (name: string): string => {
  const content = `
    <h2>Welcome to Actopod, ${name}! 🎉</h2>
    <p>Your account has been successfully verified.</p>
    <p>You're all set to start building powerful AI workflows with our Multi-LLM Node-Based Platform.</p>

    <div style="margin: 30px 0; padding: 20px; background-color: #F0FDF4; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #065F46;">🚀 Quick Start Guide</h3>
      <ul style="padding-left: 20px;">
        <li style="margin: 10px 0;">Create your first canvas</li>
        <li style="margin: 10px 0;">Add AI nodes (OpenAI, Anthropic, Google Gemini, and more)</li>
        <li style="margin: 10px 0;">Connect nodes to build powerful workflows</li>
        <li style="margin: 10px 0;">Run and iterate on your AI canvas</li>
      </ul>
    </div>

    <p style="text-align: center;">
      <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Get Started →</a>
    </p>

    <div style="margin-top: 30px; padding: 20px; background-color: #F9FAFB; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #374151;">📚 Helpful Resources</h3>
      <ul style="list-style: none; padding: 0;">
        <li style="margin: 10px 0;">
          📖 <a href="${process.env.FRONTEND_URL}/docs">Documentation</a> - Learn the basics
        </li>
        <li style="margin: 10px 0;">
          🎓 <a href="${process.env.FRONTEND_URL}/tutorials">Tutorials</a> - Step-by-step guides
        </li>
        <li style="margin: 10px 0;">
          💬 <a href="${process.env.FRONTEND_URL}/community">Community</a> - Connect with others
        </li>
        <li style="margin: 10px 0;">
          🆘 <a href="${process.env.FRONTEND_URL}/support">Support</a> - Get help anytime
        </li>
      </ul>
    </div>

    <p style="margin-top: 30px;">
      Need help getting started? Our support team is here to help at
      <a href="mailto:${process.env.AWS_SES_SUPPORT_EMAIL || 'support@actopod.dev'}">${process.env.AWS_SES_SUPPORT_EMAIL || 'support@actopod.dev'}</a>
    </p>
  `;
  return baseEmailTemplate(content);
};
