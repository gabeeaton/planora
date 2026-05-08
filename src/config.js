// ============================================================
// src/config.js
// Reads API keys from environment variables (.env file).
// Never hardcode secrets here — use .env instead.
// .env is listed in .gitignore and will never be committed.
// ============================================================

// Expo automatically exposes variables prefixed with EXPO_PUBLIC_
// to the JS bundle via process.env. No extra packages needed.

export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Vercel proxy URL — set EXPO_PUBLIC_VERCEL_API_URL in .env
// e.g. https://taskflow-abc123.vercel.app
// Leave blank to use the production Vercel URL automatically (same domain in prod)
export const VERCEL_API_URL =
  process.env.EXPO_PUBLIC_VERCEL_API_URL ?? "https://taskflow.vercel.app";

export const APP_CONFIG = {
  gptModel: "gpt-4o-mini",
  maxTasksForAI: 20,
  offlineEnabled: true,
};

// ── Feature flags ─────────────────────────────────────────────
// Set BETA_PRO_UNLOCKED = true  → everyone gets Scholar (TestFlight / soft launch)
// Set BETA_PRO_UNLOCKED = false → only real RevenueCat subscribers get Scholar
//
// DEV-only testing flags (ignored in production builds):
//   FORCE_ONBOARDING   = true → onboarding runs every launch (never skipped)
//   FORCE_WALKTHROUGH  = true → walkthrough overlay runs every launch
export const FEATURE_FLAGS = {
  BETA_PRO_UNLOCKED:  false,
  FORCE_ONBOARDING:   false, // flip to true to test onboarding repeatedly
  FORCE_WALKTHROUGH:  false, // flip to true to test walkthrough repeatedly
  // Flip to true for App Store screenshots / demo walkthroughs.
  // All screens show canned data; purchases are skipped; no real API calls.
  DEMO_MODE: false,
};

// ── Dev safety check ─────────────────────────────────────────
if (__DEV__) {
  const missing = [];
  if (!VERCEL_API_URL) missing.push("EXPO_PUBLIC_VERCEL_API_URL");
  if (!FIREBASE_CONFIG.apiKey) missing.push("EXPO_PUBLIC_FIREBASE_API_KEY");
  if (!FIREBASE_CONFIG.projectId)
    missing.push("EXPO_PUBLIC_FIREBASE_PROJECT_ID");
  if (missing.length > 0) {
    console.warn(
      `⚠️  TaskFlow: Missing environment variables:\n${missing
        .map((k) => `  • ${k}`)
        .join("\n")}\n` +
        `  Copy .env.example → .env and fill in your values, then restart Expo.`
    );
  }
}