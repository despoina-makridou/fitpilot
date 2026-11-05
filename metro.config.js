// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle model chunks and .gguf as raw assets so they ship inside the app and
// can be reassembled on first launch (see src/ai/model.ts, scripts/split-model.mjs).
config.resolver.assetExts.push('bin', 'gguf');

module.exports = config;
