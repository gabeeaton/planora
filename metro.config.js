const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Fix for Firebase JS SDK incompatibility with Expo SDK 53/54
// See: https://github.com/expo/expo/issues/36588
// Metro's new package.json:exports resolution breaks Firebase's .cjs files
config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;

module.exports = config;