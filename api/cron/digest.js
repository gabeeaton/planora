// ============================================================
// api/cron/digest.js — Daily digest email
//
// Vercel cron: runs at 12:00 UTC (7am EST) every day.
// Reads Firestore for all users, fetches their pending tasks,
// and sends a personalized digest via Resend.
//
// Required env vars:
//   RESEND_API_KEY
//   CRON_SECRET          — must match x-cron-secret header (set in vercel.json)
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY
// ============================================================

import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth }      from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const RESEND_URL = "https://api.resend.com/emails";
const FROM       = "Planora <hello@planoraapp.net>";

// ── Firebase Admin ────────────────────────────────────────────
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId:    process.env.FIREBASE_PROJECT_ID,
      clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// ── Resend helper ─────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const res = await fetch(RESEND_URL, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

// ── Task helpers ──────────────────────────────────────────────

// Firestore Admin SDK returns Timestamps as { _seconds, _nanoseconds } objects
const toDate = (val) => {
  if (!val) return null;
  if (val._seconds !== undefined) return new Date(val._seconds * 1000);
  if (val.toDate) return val.toDate();
  return new Date(val);
};

const dayLabel = (due) => {
  const now   = new Date();
  const diff  = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (diff <= 0)  return "overdue";
  if (diff === 1) return "due tomorrow";
  if (diff <= 7)  return `due in ${diff} days`;
  return `due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
};

// ── Digest email template ─────────────────────────────────────
function digestHtml(name, tasks, uid) {
  const first    = name?.split(" ")[0] ?? "there";
  const overdue  = tasks.filter((t) => t.dueDate && toDate(t.dueDate) < new Date());
  const thisWeek = tasks.filter((t) => {
    if (!t.dueDate) return false;
    const d = toDate(t.dueDate);
    const now = new Date();
    return d >= now && d <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
  const top = [...overdue, ...thisWeek].slice(0, 5);

  const taskRows = top.map((t) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td style="width:8px;vertical-align:top;padding-top:5px;">
          <div style="width:6px;height:6px;border-radius:3px;background:${overdue.includes(t) ? "#FF5C5C" : "#9060E8"};"></div>
        </td>
        <td style="padding-left:10px;">
          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1a1a2e;">${t.title}</p>
          <p style="margin:0;font-size:12px;color:#999;">
            ${t.className ? `${t.className} · ` : ""}${t.dueDate ? dayLabel(toDate(t.dueDate)) : "no due date"}
          </p>
        </td>
      </tr></table>
    </td></tr>`).join("");

  const subject = overdue.length > 0
    ? `⚠️ ${overdue.length} overdue task${overdue.length !== 1 ? "s" : ""} — daily digest`
    : `📋 Your daily digest — ${thisWeek.length} task${thisWeek.length !== 1 ? "s" : ""} this week`;

  const intro = overdue.length > 0
    ? `You have <strong>${overdue.length} overdue task${overdue.length !== 1 ? "s" : ""}</strong>. Here's what needs attention today:`
    : thisWeek.length > 0
    ? `Here's what's coming up this week:`
    : `You're all clear this week — nothing due in the next 7 days. 🎉`;

  return {
    subject,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

        <tr><td style="background:#9060E8;padding:24px 40px;">
          <p style="margin:0;font-size:18px;font-weight:800;color:#ffffff;">Planora</p>
        </td></tr>

        <tr><td style="padding:32px 40px;">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a1a2e;">
            Good morning, ${first}
          </h1>
          <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">${intro}</p>

          ${top.length > 0 ? `<table width="100%" cellpadding="0" cellspacing="0">${taskRows}</table>` : ""}

          <p style="margin:24px 0 0;font-size:13px;color:#aaa;">
            Open Planora to check off tasks and get your AI focus recommendation.
          </p>
        </td></tr>

        <tr><td style="padding:20px 40px;background:#f9f9f9;border-top:1px solid #eee;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:#aaa;">Planora · planoraapp.net</p>
          <p style="margin:0;font-size:11px;">
            <a href="https://taskflow-mocha-theta.vercel.app/api/unsubscribe?uid=${uid}&sig=${crypto.createHmac("sha256", process.env.CRON_SECRET ?? "").update(uid).digest("hex").slice(0, 32)}" style="color:#aaa;">Unsubscribe from daily emails</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

// ── Handler ───────────────────────────────────────────────────
export default async function handler(req, res) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.authorization ?? "";
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const app = getAdminApp();
  const db  = getFirestore(app);

  let sent = 0, skipped = 0, errors = 0;

  try {
    // Fetch all user profiles
    const profilesSnap = await db.collection("userProfiles").get();

    for (const doc of profilesSnap.docs) {
      const uid     = doc.id;
      const profile = doc.data();

      // Skip if opted out
      if (profile.digestOptOut) { skipped++; continue; }

      // Get email from Firebase Auth
      let email;
      try {
        const userRecord = await getAuth(app).getUser(uid);
        email = userRecord.email;
        if (!email || !userRecord.emailVerified) { skipped++; continue; }
      } catch { skipped++; continue; }

      // Fetch pending tasks
      let tasks = [];
      try {
        const tasksSnap = await db
          .collection("tasks")
          .where("userId", "==", uid)
          .where("completed", "==", false)
          .get();
        tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch { skipped++; continue; }

      // Skip if no tasks at all
      if (tasks.length === 0) { skipped++; continue; }

      // Build and send digest
      try {
        const { subject, html } = digestHtml(profile.name, tasks, uid);
        await sendEmail({ to: email, subject, html });
        sent++;
      } catch (err) {
        console.error(`Digest failed for ${uid}:`, err.message);
        errors++;
      }

      // Small delay to avoid Resend rate limits
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`Digest: ${sent} sent, ${skipped} skipped, ${errors} errors`);
    return res.status(200).json({ ok: true, sent, skipped, errors });
  } catch (err) {
    console.error("Digest cron failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
