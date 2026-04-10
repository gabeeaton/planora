// ============================================================
// api/ai.js — Vercel serverless function
//
// Proxies OpenAI calls server-side so the API key never
// reaches the client bundle.
//
// Security:
//  - Verifies Firebase ID token on every request
//  - Rate-limits free users to 10 AI calls/day (UTC)
//  - Pro users are unlimited
// ============================================================

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import OpenAI from "openai";

// ── Firebase Admin init (lazy, singleton) ────────────────────
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel env vars can't contain raw newlines — replace \\n with \n
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// ── OpenAI client (server-side key, no dangerouslyAllowBrowser) ──
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Rate limit config ────────────────────────────────────────
const FREE_DAILY_LIMIT = 10;

// Returns today's date string in UTC (e.g. "2025-02-24")
const todayUTC = () => new Date().toISOString().slice(0, 10);

// ── Main handler ─────────────────────────────────────────────
export default async function handler(req, res) {
  // Only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── 1. Authenticate ──────────────────────────────────────
  const authHeader = req.headers.authorization ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  let uid;
  try {
    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // ── 2. Rate limiting ────────────────────────────────────
  const app = getAdminApp();
  const db = getFirestore(app);
  const profileRef = db.collection("userProfiles").doc(uid);

  let isPro = false;
  try {
    const snap = await profileRef.get();
    const data = snap.data() ?? {};
    isPro = data.isPro === true;

    if (!isPro) {
      const today = todayUTC();
      const callsDate = data.aiCallsDate ?? "";
      const callsToday = callsDate === today ? (data.aiCallsToday ?? 0) : 0;

      if (callsToday >= FREE_DAILY_LIMIT) {
        return res.status(429).json({
          error: "Daily AI limit reached",
          limitReached: true,
          limit: FREE_DAILY_LIMIT,
        });
      }

      // Increment counter (atomic)
      await profileRef.set(
        {
          aiCallsToday: callsDate === today ? FieldValue.increment(1) : 1,
          aiCallsDate: today,
        },
        { merge: true }
      );
    }
  } catch (err) {
    // Rate limit check failed — fail open (don't block the user) but log it
    console.error("Rate limit check failed:", err);
  }

  // ── 3. Parse request body ────────────────────────────────
  const { model, messages, temperature, max_tokens } = req.body ?? {};
  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  // Whitelist allowed models — prevents abuse
  const ALLOWED_MODELS = ["gpt-4o", "gpt-4o-mini"];
  if (!ALLOWED_MODELS.includes(model)) {
    return res.status(400).json({ error: "Model not allowed" });
  }

  // ── 4. Call OpenAI ───────────────────────────────────────
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: temperature ?? 0.3,
      max_tokens: max_tokens ?? 500,
    });

    return res.status(200).json({
      content: completion.choices[0].message.content,
    });
  } catch (err) {
    console.error("OpenAI error:", err);
    const status = err?.status ?? 500;
    if (status === 429) {
      return res.status(503).json({ error: "AI is busy — try again in a moment." });
    }
    return res.status(502).json({ error: "AI request failed" });
  }
}
