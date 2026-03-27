const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Excluir la carpeta dist/ (generada por electron:build) del watcher de Metro
config.resolver.blockList = [
  /dist\/.*/,
  /release\/.*/,
];

module.exports = config;
