import PostHog from "posthog-react-native";

// Singleton — import { track, identify, posthog } anywhere in the app.
// Fails silently if key is missing (local dev without .env key).
export const posthog = new PostHog(
  process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
  {
    host: "https://us.i.posthog.com",
    disabled: !process.env.EXPO_PUBLIC_POSTHOG_KEY,
  }
);

export const track = (event, props = {}) => {
  try { posthog.capture(event, props); } catch {}
};

export const identify = (userId, traits = {}) => {
  try { posthog.identify(userId, traits); } catch {}
};
