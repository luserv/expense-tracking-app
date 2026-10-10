import { app, BrowserWindow, ipcMain, protocol, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { CREATE_TABLES, CREATE_INDEXES, MIGRATIONS, SEED, SYNC_TABLES, buildMergeStatement } from '../utils/dbSchema';
import { assertReadStatement, assertDataStatement, assertTransactionControl } from './sqlGuard';
import {
  isGoogleAccountsUrl, isOAuthPopupUrl, isAppUrl, isExternalLink, ISOLATED_WEB_PREFERENCES, DEV_SERVER_ORIGIN,
} from './navigationPolicy';
import { createAppProtocolHandler } from './appProtocol';
import type { GoogleOAuthParams, GoogleOAuthTokens, IpcOutcome } from './ipcContract';

// Minimal typing for the subset of better-sqlite3 used here. It is loaded with a
// runtime require() because the packaged path differs from the dev one.
interface SqliteStatement {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
}

interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  pragma(sql: string): unknown;
  transaction<F extends (...args: never[]) => unknown>(fn: F): F;
  close(): void;
}

type SqliteDatabaseConstructor = new (filename: string) => SqliteDatabase;

// Compiled to electron-build/electron/, so the app root is two levels up
// (in packaged builds: …/app.asar).
const APP_ROOT = path.resolve(__dirname, '..', '..');

protocol.registerSchemesAsPrivileged([
  // corsEnabled es CLAVE: los fonts (@font-face / FontFace API) se piden siempre en
  // modo CORS aunque sean same-origin. Sin esto Chromium bloquea el TTF de Ionicons
  // y los íconos quedan invisibles, aunque el resto de assets (no-cors) sí cargue.
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'gastos.db');

let db!: SqliteDatabase;

function initDB(): void {
  const bsPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'better-sqlite3')
    : 'better-sqlite3';
  const Database = require(bsPath) as SqliteDatabaseConstructor;
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Esquema desde la fuente única compartida (utils/dbSchema.ts).
  // Migraciones ANTES que los índices: agregan columnas que estos referencian.
  for (const sql of CREATE_TABLES) db.exec(sql);
  for (const sql of MIGRATIONS) { try { db.prepare(sql).run(); } catch {} }
  for (const sql of CREATE_INDEXES) { try { db.exec(sql); } catch {} }
  // Seed only on first run: if accounts already exist, skip to avoid overhead.
  const hasAccounts = db.prepare('SELECT COUNT(*) c FROM account').get() as { c: number } | undefined;
  if (hasAccounts && hasAccounts.c === 0) {
    for (const sql of SEED) db.exec(sql);
  }
}

// ── IPC: database ─────────────────────────────────────────────────────────────

ipcMain.handle('db:exec', (_event, sql: unknown) => {
  assertTransactionControl(sql);
  db.exec(sql);
});

ipcMain.handle('db:run', (_event, sql: unknown, params?: unknown[]) => {
  assertDataStatement(sql);
  db.prepare(sql).run(...(params || []));
});

ipcMain.handle('db:getAll', (_event, sql: unknown, params?: unknown[]) => {
  assertReadStatement(sql);
  return db.prepare(sql).all(...(params || []));
});

ipcMain.handle('db:getFirst', (_event, sql: unknown, params?: unknown[]) => {
  assertReadStatement(sql);
  return db.prepare(sql).get(...(params || [])) ?? null;
});

// ── IPC: file system (backup) ─────────────────────────────────────────────────

ipcMain.handle('db:readAsBase64', (): string => {
  db.pragma('wal_checkpoint(FULL)');
  return fs.readFileSync(dbPath).toString('base64');
});

ipcMain.handle('db:writeFromBase64', (_event, base64: string): IpcOutcome => {
  try {
    const buffer = Buffer.from(base64, 'base64');
    db.pragma('wal_checkpoint(FULL)');
    db.close();
    fs.writeFileSync(dbPath, buffer);
    initDB();
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
});

// Merge por registro: ATTACH la DB remota y hace UPSERT con LWW por updated_at.
ipcMain.handle('db:mergeFromBase64', (_event, base64: string): IpcOutcome => {
  const tmpPath = path.join(userDataPath, '_sync_remote.db');
  try {
    fs.writeFileSync(tmpPath, Buffer.from(base64, 'base64'));
    // Bound parameter: works with any path (spaces, accents) and never builds SQL from it.
    db.prepare('ATTACH DATABASE ? AS remote').run(tmpPath);
    const merge = db.transaction(() => {
      for (const { table, pk } of SYNC_TABLES) {
        const localCols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(r => r.name);
        const remoteCols = (db.prepare(`PRAGMA remote.table_info(${table})`).all() as { name: string }[]).map(r => r.name);
        const cols = localCols.filter(c => remoteCols.includes(c));
        if (!cols.includes('updated_at')) continue;
        db.exec(buildMergeStatement(table, pk, cols));
      }
    });
    merge();
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    try { db.exec('DETACH DATABASE remote'); } catch {}
    try { fs.unlinkSync(tmpPath); } catch {}
  }
});

// Genera un PDF a partir de HTML (reporte de préstamo) y lo guarda.
ipcMain.handle('report:savePdf', async (_event, html: string, baseName: string): Promise<IpcOutcome> => {
  let win: BrowserWindow | null = null;
  const tmpHtml = path.join(userDataPath, '_report.html');
  try {
    fs.writeFileSync(tmpHtml, html);
    win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    await win.loadFile(tmpHtml);
    const pdf = await win.webContents.printToPDF({ printBackground: true });
    const res = await dialog.showSaveDialog({
      title: 'Guardar reporte',
      defaultPath: `${baseName}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    fs.writeFileSync(res.filePath, pdf);
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    try { fs.unlinkSync(tmpHtml); } catch {}
  }
});

ipcMain.handle('db:signature', (): string => {
  let rows = 0, sum = 0, max = 0;
  for (const { table } of SYNC_TABLES) {
    const r = db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(updated_at),0) s, COALESCE(MAX(updated_at),0) m FROM ${table}`).get() as { c: number; s: number; m: number };
    rows += r.c; sum += r.s; max = Math.max(max, r.m);
  }
  return `${rows}:${sum}:${max}`;
});

ipcMain.handle('fs:importDB', async (): Promise<IpcOutcome> => {
  const result = await dialog.showOpenDialog({
    title: 'Importar base de datos',
    filters: [{ name: 'SQLite DB', extensions: ['db', 'sqlite', 'sqlite3'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  try {
    fs.copyFileSync(result.filePaths[0], dbPath);
    db.close();
    initDB();
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
});

ipcMain.handle('fs:exportDB', async (): Promise<IpcOutcome> => {
  const result = await dialog.showSaveDialog({
    title: 'Exportar base de datos',
    defaultPath: `gastos_backup_${Date.now()}.db`,
    filters: [{ name: 'SQLite DB', extensions: ['db'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  try {
    db.pragma('wal_checkpoint(FULL)');
    fs.copyFileSync(dbPath, result.filePath);
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
});

// ── IPC: Google OAuth (reemplaza signInWithPopup de Firebase) ─────────────────

ipcMain.handle('auth:googleOAuth', (_event, { authUrl, redirectUri }: GoogleOAuthParams): Promise<GoogleOAuthTokens> => {
  if (!isGoogleAccountsUrl(authUrl)) {
    return Promise.reject(new Error('OAuth URL must point to accounts.google.com'));
  }
  return new Promise<GoogleOAuthTokens>((resolve, reject) => {
    let handled = false;

    const authWindow = new BrowserWindow({
      width: 500,
      height: 650,
      alwaysOnTop: true,
      webPreferences: { ...ISOLATED_WEB_PREFERENCES },
    });

    authWindow.loadURL(authUrl);

    authWindow.webContents.on('will-redirect', (event, redirectUrl) => {
      if (!redirectUrl.startsWith(redirectUri) || handled) return;
      handled = true;
      event.preventDefault();
      authWindow.destroy();

      const hash = redirectUrl.includes('#') ? redirectUrl.split('#')[1] : '';
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const id_token = params.get('id_token');

      if (access_token && id_token) {
        resolve({ access_token, id_token });
      } else {
        reject(new Error(params.get('error') || 'No se recibieron los tokens de Google'));
      }
    });

    authWindow.on('closed', () => {
      if (!handled) reject(new Error('Autenticación cancelada'));
    });
  });
});

// ── Window ────────────────────────────────────────────────────────────────────

// In packaged builds APP_ROOT is …/app.asar, so this is …/app.asar/dist as before.
function getDistPath(): string {
  return path.join(APP_ROOT, 'dist');
}

let splash: BrowserWindow | null = null;

function createSplash(): void {
  splash = new BrowserWindow({
    width: 340, height: 380,
    frame: false, resizable: false, center: true, show: true,
    backgroundColor: '#0b0b0f',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splash.loadFile(path.join(APP_ROOT, 'electron', 'splash.html'));
  splash.on('closed', () => { splash = null; });
}

function closeSplash(): void {
  if (splash && !splash.isDestroyed()) splash.destroy();
  splash = null;
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 420,
    height: 800,
    show: false, // se muestra recién cuando el contenido terminó de cargar
    icon: path.join(APP_ROOT, 'assets', 'images', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Mostrar la ventana y cerrar el splash una vez cargado el bundle.
  win.webContents.once('did-finish-load', () => {
    closeSplash();
    win.show();
  });
  // Red de seguridad: si algo falla, no dejar el splash colgado para siempre.
  setTimeout(() => { if (splash) { closeSplash(); if (!win.isVisible()) win.show(); } }, 20000);

  win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (isOAuthPopupUrl(targetUrl)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { width: 500, height: 650, webPreferences: { ...ISOLATED_WEB_PREFERENCES } },
      };
    }
    if (isExternalLink(targetUrl)) shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  // The main window only ever shows the bundled app; anything else opens outside.
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (isAppUrl(targetUrl)) return;
    event.preventDefault();
    if (isExternalLink(targetUrl)) shell.openExternal(targetUrl);
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    win.loadURL(DEV_SERVER_ORIGIN);
    win.webContents.openDevTools();
  } else {
    win.loadURL('app://./');
  }
}

process.on('uncaughtException', (err) => {
  dialog.showErrorBox('Error al iniciar Segasto', err.stack || err.message);
  app.quit();
});

app.whenReady().then(() => {
  protocol.handle('app', createAppProtocolHandler(getDistPath));

  // Mostrar el splash de inmediato; diferir initDB para que alcance a pintarse
  // (initDB es síncrono y puede tardar la primera vez creando índices).
  createSplash();
  const boot = () => {
    try {
      initDB();
    } catch (err) {
      closeSplash();
      const e = err as Error;
      dialog.showErrorBox('Error al iniciar la base de datos', e.stack || e.message);
      app.quit();
      return;
    }
    createWindow();
  };
  if (splash) splash.webContents.once('did-finish-load', boot);
  else boot();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err: Error) => {
  dialog.showErrorBox('Error al iniciar Segasto', err.stack || err.message);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
