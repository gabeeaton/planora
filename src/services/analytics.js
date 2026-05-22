import PostHog from "posthog-react-native";

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;

// Only instantiate when a real key exists — avoids PostHog's key-validation error in dev.
export const posthog = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, { host: "https://us.i.posthog.com" })
  : null;

export const track = (event, props = {}) => {
  try { posthog?.capture(event, props); } catch {}
};

export const identify = (userId, traits = {}) => {
  try { posthog?.identify(userId, traits); } catch {}
};
