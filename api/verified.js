// ============================================================
// api/verified.js
// Landing page after Firebase email verification.
// Firebase redirects here after the user clicks the verify link.
// This page auto-opens the app so they can sign in.
// ============================================================

export default function handler(req, res) {
  const deepLink = "planora://";

  res.setHeader("Content-Type", "text/html");
  return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Email verified — Planora</title>
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
    .logo { font-size: 24px; font-weight: 800; color: #7040BE; margin-bottom: 24px; }
    .icon {
      width: 64px; height: 64px; border-radius: 32px;
      background: rgba(92,255,143,0.15); border: 2px solid #5CFF8F;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; margin: 0 auto 20px; line-height: 64px;
    }
    h1 { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
    p  { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 28px; }
    .btn {
      display: block; background: #7040BE; color: #fff;
      font-size: 16px; font-weight: 700; text-decoration: none;
      padding: 14px 32px; border-radius: 12px; margin-bottom: 16px;
    }
    .hint { font-size: 12px; color: #aaa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Planora</div>
    <div class="icon">✓</div>
    <h1>Email verified!</h1>
    <p>Your email has been confirmed. Open Planora and sign in to get started.</p>
    <a class="btn" href="${deepLink}">Open Planora</a>
    <p class="hint">Make sure Planora is installed on this device.</p>
  </div>
  <script>
    window.location = "${deepLink}";
  </script>
</body>
</html>`);
}
