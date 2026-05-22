const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// .cjs handles Firebase SDK files; package exports must stay on for posthog-react-native subpath imports.
config.resolver.sourceExts.push("cjs");

// Explicit conditions: ensures Firebase resolves to its CJS/default build (not the browser bundle)
// while still allowing PostHog subpath exports to resolve correctly.
config.resolver.unstable_conditionNames = ["require", "default"];

module.exports = config;