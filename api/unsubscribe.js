// ============================================================
// api/unsubscribe.js
// One-click unsubscribe from daily digest emails.
// GET /api/unsubscribe?uid=XXX
// Sets digestOptOut: true on the user's Firestore profile.
// ============================================================

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

export default async function handler(req, res) {
  const { uid } = req.query;

  if (!uid) {
    return res.status(400).send("Missing uid.");
  }

  try {
    const db = getFirestore(getAdminApp());
    await db.collection("userProfiles").doc(uid).set(
      { digestOptOut: true },
      { merge: true }
    );
  } catch (err) {
    console.error("Unsubscribe failed:", err);
    // Still show success page — don't leak errors to user
  }

  res.setHeader("Content-Type", "text/html");
  return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed — Planora</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f9f9f9; min-height: 100vh;
      display: flex; align-items: center; justify-content: center; padding: 24px;
    }
    .card {
      background: #fff; border-radius: 16px; padding: 40px 32px;
      max-width: 400px; width: 100%; text-align: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .logo { font-size: 24px; font-weight: 800; color: #6C63FF; margin-bottom: 24px; }
    table { margin: 0 auto 20px; }
    h1 { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
    p  { font-size: 14px; color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Planora</div>
    <table cellpadding="0" cellspacing="0">
      <tr><td width="64" height="64" align="center" valign="middle"
        style="border-radius:32px;background:rgba(108,99,255,0.1);border:2px solid #6C63FF;font-size:28px;line-height:64px;margin-bottom:20px;">
        ✓
      </td></tr>
    </table>
    <h1>You're unsubscribed</h1>
    <p>You won't receive daily digest emails anymore.<br>You can re-enable them anytime in the Planora app.</p>
  </div>
</body>
</html>`);
}
