const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// .cjs handles Firebase SDK files; package exports must stay on for posthog-react-native subpath imports.
config.resolver.sourceExts.push("cjs");

module.exports = config;