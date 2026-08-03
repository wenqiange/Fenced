// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package.json `exports` field resolution so that workspace
// packages (e.g. @fenced/ai/client) can expose subpath exports.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
