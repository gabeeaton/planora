// ============================================================
// api/reset-redirect.js
// Intermediate page that redirects password reset links into the app.
// Email links to: /api/reset-redirect?oobCode=XXX
// Page immediately tries: planora://reset-password?oobCode=XXX
// Falls back to instructions if the app isn't installed.
// ============================================================

export default function handler(req, res) {
  const { oobCode } = req.query;

  if (!oobCode) {
    return res.status(400).send("Missing reset code.");
  }

  const deepLink = `planora://reset-password?oobCode=${encodeURIComponent(oobCode)}`;

  res.setHeader("Content-Type", "text/html");
  return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset your Planora password</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f9f9f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      padding: 40px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .logo { font-size: 24px; font-weight: 800; color: #6C63FF; margin-bottom: 24px; }
    .icon {
      width: 64px; height: 64px; border-radius: 32px;
      background: rgba(108,99,255,0.1); border: 2px solid #6C63FF;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; margin: 0 auto 20px;
    }
    h1 { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
    p  { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 28px; }
    .btn {
      display: block; background: #6C63FF; color: #fff;
      font-size: 16px; font-weight: 700; text-decoration: none;
      padding: 14px 32px; border-radius: 12px; margin-bottom: 16px;
    }
    .hint { font-size: 12px; color: #aaa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Planora</div>
    <div class="icon">🔑</div>
    <h1>Reset your password</h1>
    <p>Tap the button below to open Planora and set a new password.</p>
    <a class="btn" href="${deepLink}" id="openBtn">Open Planora</a>
    <p class="hint">Make sure Planora is installed on this device.</p>
  </div>
  <script>
    // Auto-open the app on page load
    window.location = "${deepLink}";
  </script>
</body>
</html>`);
}
