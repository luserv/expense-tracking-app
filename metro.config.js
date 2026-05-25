const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Excluir la carpeta dist/ (generada por electron:build) del watcher de Metro.
// Las rutas en blockList se comparan contra la ruta completa del archivo, por eso
// anclar al projectRoot evita bloquear node_modules/*/dist/* (p.ej. react-native-web/dist).
const _esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [
  new RegExp('^' + _esc(path.join(projectRoot, 'dist')) + '/'),
  new RegExp('^' + _esc(path.join(projectRoot, 'release')) + '/'),
];

// ── pnpm virtual store support ──────────────────────────────────────────────
// pnpm instala paquetes en node_modules/.pnpm/ con symlinks relativos.
// Metro no puede seguir esos symlinks cuando resuelve subpaths como
// "react-native-web/dist/index" desde dentro del virtual store.
// Usamos resolveRequest para redirigir esas resoluciones al paquete hoisted.

// Construir un mapa de aliases: paquetes que deben resolverse siempre
// desde el root del proyecto (ignorando el contexto pnpm).
const FORCE_HOIST = [
  'react-native-web',
  'react-native',
  'react',
  'react-dom',
];

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Forzar resolución desde el root del proyecto para paquetes clave
  for (const pkg of FORCE_HOIST) {
    if (moduleName === pkg || moduleName.startsWith(pkg + '/')) {
      const relativePath = moduleName.slice(pkg.length); // e.g. "/dist/index"
      const candidates = [
        path.join(projectRoot, 'node_modules', pkg + relativePath + '.js'),
        path.join(projectRoot, 'node_modules', pkg + relativePath, 'index.js'),
        path.join(projectRoot, 'node_modules', pkg + relativePath),
      ];
      for (const candidate of candidates) {
        try {
          if (fs.existsSync(candidate)) {
            return { filePath: candidate, type: 'sourceFile' };
          }
        } catch (_) {}
      }
    }
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.watchFolders = [
  ...(config.watchFolders || []),
  path.join(projectRoot, 'node_modules/.pnpm'),
];

config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths || []),
  path.join(projectRoot, 'node_modules'),
];

module.exports = config;
