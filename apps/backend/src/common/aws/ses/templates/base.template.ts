export const baseEmailTemplate = (content: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flopods</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9fafb;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 30px;
      border-bottom: 2px solid #4F46E5;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #4F46E5;
      text-decoration: none;
    }
    .content {
      color: #374151;
      font-size: 16px;
    }
    .content h2 {
      color: #111827;
      font-size: 24px;
      margin-top: 0;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: #4F46E5;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      margin: 20px 0;
      font-weight: 600;
      transition: background-color 0.3s;
    }
    .button:hover {
      background-color: #4338CA;
    }
    .footer {
      text-align: center;
      padding-top: 30px;
      margin-top: 30px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
    .footer a {
      color: #4F46E5;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🚀 Flopods</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Flopods. All rights reserved.</p>
      <p>AI Workflow Canvas - Multi-LLM Node-Based Platform</p>
      <p>
        <a href="${process.env.FRONTEND_URL}/help">Help Center</a> •
        <a href="${process.env.FRONTEND_URL}/privacy">Privacy Policy</a> •
        <a href="${process.env.FRONTEND_URL}/terms">Terms of Service</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
