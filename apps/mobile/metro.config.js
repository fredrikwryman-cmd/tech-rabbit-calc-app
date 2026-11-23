/**
 * Metro i en monorepo: titta aven utanfor apps/mobile, sa att packages/engine
 * kan importeras direkt som TypeScript.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projektet = __dirname;
const roten = path.resolve(projektet, '../..');

const config = getDefaultConfig(projektet);

config.watchFolders = [roten];
config.resolver.nodeModulesPaths = [
  path.resolve(projektet, 'node_modules'),
  path.resolve(roten, 'node_modules'),
];
// Hierarkisk uppslagning lamnas pa (Expos vantade varde). nodeModulesPaths
// ovan racker for att hitta packages/engine i monorepon.

module.exports = config;
