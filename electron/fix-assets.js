/**
 * Post-export (corre entre `expo export` y `electron-builder`).
 *
 * Problema: expo exporta los assets (fonts de @expo/vector-icons, PNGs de
 * expo-router y react-navigation) a `dist/assets/node_modules/.pnpm/.../archivo.hash.ext`.
 * electron-builder DESCARTA cualquier archivo bajo un directorio `node_modules`
 * que no sea una dependencia declarada — sin importar el orden de `files` —, así que
 * esos assets nunca entran al asar y en el build los íconos salen vacíos.
 *
 * Solución: mover cada asset a `dist/assets/_pkg/<basename>` (fuera de node_modules,
 * con nombre ya hasheado → sin colisiones) y reescribir las URLs en los bundles JS
 * para que tanto el build web como Electron apunten a la nueva ubicación.
 *
 * Idempotente: si no queda nada bajo node_modules, no hace nada.
 */
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const assetsDir = path.join(dist, 'assets');
const outDir = path.join(assetsDir, '_pkg');

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function main() {
  if (!fs.existsSync(assetsDir)) { console.log('[fix-assets] no hay dist/assets, nada que hacer'); return; }

  const nm = `${path.sep}node_modules${path.sep}`;
  const files = walk(assetsDir, []).filter(p => p.includes(nm));
  if (!files.length) { console.log('[fix-assets] no hay assets bajo node_modules (ya relocalizados)'); return; }

  fs.mkdirSync(outDir, { recursive: true });

  const renames = [];
  for (const abs of files) {
    const rel = path.relative(dist, abs).split(path.sep).join('/'); // assets/node_modules/.../X.hash.ext
    const base = path.basename(abs);
    const dest = path.join(outDir, base);
    if (fs.existsSync(dest) && fs.readFileSync(dest).length !== fs.statSync(abs).size) {
      console.warn('[fix-assets] colisión de nombre:', base);
    }
    fs.renameSync(abs, dest);
    renames.push({ oldUrl: '/' + rel, newUrl: '/assets/_pkg/' + base });
  }

  // Reescribir referencias en los bundles JS (y el index.html por las dudas).
  const jsDir = path.join(dist, '_expo', 'static', 'js', 'web');
  const targets = [];
  if (fs.existsSync(jsDir)) {
    for (const f of fs.readdirSync(jsDir)) if (f.endsWith('.js')) targets.push(path.join(jsDir, f));
  }
  const indexHtml = path.join(dist, 'index.html');
  if (fs.existsSync(indexHtml)) targets.push(indexHtml);

  let totalReplacements = 0;
  for (const file of targets) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    for (const { oldUrl, newUrl } of renames) {
      if (content.includes(oldUrl)) {
        content = content.split(oldUrl).join(newUrl);
        totalReplacements++;
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(file, content);
  }

  // Borrar el árbol node_modules ya vacío dentro de assets.
  fs.rmSync(path.join(assetsDir, 'node_modules'), { recursive: true, force: true });

  console.log(`[fix-assets] ${renames.length} assets movidos a assets/_pkg, ${totalReplacements} referencias reescritas`);
}

main();
