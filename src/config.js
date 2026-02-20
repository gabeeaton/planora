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

export const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

export const APP_CONFIG = {
  gptModel: "gpt-4o",
  maxTasksForAI: 20,
  offlineEnabled: true,
};

// ── Dev safety check ─────────────────────────────────────────
// Warns you in the console if you forgot to set up .env
if (__DEV__) {
  const missing = [];
  if (!OPENAI_API_KEY) missing.push("EXPO_PUBLIC_OPENAI_API_KEY");
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
