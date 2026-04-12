// ============================================================
// api/email.js — Vercel serverless function
//
// Sends transactional emails via Resend.
// Currently handles: welcome email on signup.
//
// Required env vars:
//   RESEND_API_KEY      — from resend.com dashboard
//   EMAIL_API_SECRET    — shared secret, sent by app as x-api-secret header
//   VERCEL_API_URL      — used to build unsubscribe links (optional)
// ============================================================

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const RESEND_URL  = "https://api.resend.com/emails";
const FROM        = "Planora <hello@planoraapp.net>";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

async function sendEmail({ to, subject, html }) {
  const res = await fetch(RESEND_URL, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Email templates ───────────────────────────────────────────

function welcomeHtml(name) {
  const first = name?.split(" ")[0] ?? "there";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr><td style="background:#6C63FF;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Planora</p>
          <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Your AI Academic Coach</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e;">
            Welcome, ${first}! 👋
          </h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#555;">
            You're all set up on Planora. Here's what you can do right now:
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            ${[
              ["📚", "Add your classes", "Set up your classes in Profile so the AI can factor in grades and credit hours."],
              ["📋", "Import your syllabus", "Tap the upload icon on the dashboard to import your Canvas calendar or syllabus."],
              ["🎯", "Find My Focus", "Tap \"What do I do right now?\" and the AI will tell you exactly what to work on."],
            ].map(([icon, title, desc]) => `
            <tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="font-size:20px;padding-right:14px;vertical-align:top;">${icon}</td>
                <td>
                  <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1a1a2e;">${title}</p>
                  <p style="margin:0;font-size:13px;color:#888;line-height:1.5;">${desc}</p>
                </td>
              </tr></table>
            </td></tr>`).join("")}
          </table>

          <p style="margin:0 0 28px;font-size:14px;color:#888;line-height:1.6;">
            Questions? Just reply to this email — I read every one.
          </p>

          <p style="margin:0;font-size:14px;color:#555;">
            — Gabe, founder of Planora
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 40px;background:#f9f9f9;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#aaa;">
            Planora · planoraapp.net<br>
            You're receiving this because you created an account.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Email templates ───────────────────────────────────────────

function verifyHtml(verifyUrl) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

        <tr><td style="background:#6C63FF;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Planora</p>
          <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Your AI Academic Coach</p>
        </td></tr>

        <tr><td style="padding:40px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr><td width="64" height="64" align="center" valign="middle"
              style="border-radius:32px;background:rgba(108,99,255,0.1);border:2px solid #6C63FF;font-size:28px;line-height:64px;">
              ✉️
            </td></tr>
          </table>
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1a1a2e;">Verify your email</h1>
          <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#555;">
            Tap the button below to verify your email address and activate your Planora account.
          </p>

          <a href="${verifyUrl}" style="display:inline-block;background:#6C63FF;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:12px;">
            Verify my email
          </a>

          <p style="margin:32px 0 0;font-size:13px;color:#aaa;line-height:1.6;">
            If you didn't create a Planora account, you can ignore this email.<br>
            This link expires in 24 hours.
          </p>
        </td></tr>

        <tr><td style="padding:24px 40px;background:#f9f9f9;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#aaa;">Planora · planoraapp.net</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function resetHtml(resetUrl) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

        <tr><td style="background:#6C63FF;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Planora</p>
          <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Your AI Academic Coach</p>
        </td></tr>

        <tr><td style="padding:40px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr><td width="64" height="64" align="center" valign="middle"
              style="border-radius:32px;background:rgba(108,99,255,0.1);border:2px solid #6C63FF;font-size:28px;line-height:64px;">
              🔑
            </td></tr>
          </table>
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1a1a2e;">Reset your password</h1>
          <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#555;">
            Tap the button below to choose a new password for your Planora account.
          </p>

          <a href="${resetUrl}" style="display:inline-block;background:#6C63FF;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:12px;">
            Reset password
          </a>

          <p style="margin:32px 0 0;font-size:13px;color:#aaa;line-height:1.6;">
            If you didn't request a password reset, you can ignore this email.<br>
            This link expires in 1 hour.
          </p>
        </td></tr>

        <tr><td style="padding:24px 40px;background:#f9f9f9;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#aaa;">Planora · planoraapp.net</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify shared secret
  const secret = req.headers["x-api-secret"];
  if (!secret || secret !== process.env.EMAIL_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { type, email, name } = req.body ?? {};

  if (!type || !email) {
    return res.status(400).json({ error: "Missing type or email" });
  }

  try {
    if (type === "welcome") {
      await sendEmail({
        to:      email,
        subject: "Welcome to Planora 👋",
        html:    welcomeHtml(name),
      });
      return res.status(200).json({ ok: true });
    }

    if (type === "verify") {
      const app = getAdminApp();
      const verifyUrl = await getAuth(app).generateEmailVerificationLink(email, {
        url: "https://planoraapp.net/verify",
      });
      await sendEmail({
        to:      email,
        subject: "Verify your Planora email",
        html:    verifyHtml(verifyUrl),
      });
      return res.status(200).json({ ok: true });
    }

    if (type === "reset") {
      const app = getAdminApp();
      // Generate Firebase reset link, extract oobCode, build our own redirect URL
      const firebaseUrl = await getAuth(app).generatePasswordResetLink(email);
      const oobCode = new URL(firebaseUrl).searchParams.get("oobCode");
      const vercelUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://taskflow-mocha-theta.vercel.app";
      const resetUrl = `${vercelUrl}/api/reset-redirect?oobCode=${encodeURIComponent(oobCode)}`;
      await sendEmail({
        to:      email,
        subject: "Reset your Planora password",
        html:    resetHtml(resetUrl),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown email type: ${type}` });
  } catch (err) {
    console.error("Email send failed:", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
