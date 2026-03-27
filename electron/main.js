const { app, BrowserWindow, ipcMain, protocol, net, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'gastos.db');

let db = null;

function initDB() {
  const bsPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'better-sqlite3')
    : 'better-sqlite3';
  const Database = require(bsPath);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS account (
      account_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT DEFAULT 'USD'
    );

    CREATE TABLE IF NOT EXISTS category (
      category_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#007AFF',
      icon TEXT,
      type TEXT CHECK(type IN ('income', 'expense')) DEFAULT 'expense'
    );

    CREATE TABLE IF NOT EXISTS expense (
      expense_id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category_id TEXT,
      account_id TEXT,
      notes TEXT,
      type TEXT CHECK(type IN ('income', 'expense')) DEFAULT 'expense',
      FOREIGN KEY (category_id) REFERENCES category(category_id),
      FOREIGN KEY (account_id) REFERENCES account(account_id)
    );

    CREATE TABLE IF NOT EXISTS person (
      person_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS loan (
      loan_id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      is_paid INTEGER DEFAULT 0,
      interest_rate REAL DEFAULT 0,
      interest_type TEXT DEFAULT 'simple',
      months INTEGER DEFAULT 1,
      FOREIGN KEY (person_id) REFERENCES person(person_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS payment (
      payment_id TEXT PRIMARY KEY,
      loan_id TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (loan_id) REFERENCES loan(loan_id)
    );
  `);

  // Migración: columnas de interés en loan (para instancias existentes)
  try { db.prepare("ALTER TABLE loan ADD COLUMN interest_rate REAL DEFAULT 0").run(); } catch {}
  try { db.prepare("ALTER TABLE loan ADD COLUMN interest_type TEXT DEFAULT 'simple'").run(); } catch {}
  try { db.prepare("ALTER TABLE loan ADD COLUMN months INTEGER DEFAULT 1").run(); } catch {}

  db.exec(`
    INSERT OR IGNORE INTO account (account_id, name, currency) VALUES
      ('acc_cash', 'Efectivo', 'USD'),
      ('acc_bank', 'Banco', 'USD');
  `);

  db.exec(`
    INSERT OR IGNORE INTO category (category_id, name, color, icon, type) VALUES
      ('cat_food',       'Alimentación',    '#FF6B6B', 'restaurant',         'expense'),
      ('cat_transport',  'Transporte',      '#4ECDC4', 'car',                'expense'),
      ('cat_housing',    'Vivienda',        '#45B7D1', 'home',               'expense'),
      ('cat_health',     'Salud',           '#96CEB4', 'medical',            'expense'),
      ('cat_entertain',  'Entretenimiento', '#F7B731', 'game-controller',    'expense'),
      ('cat_clothes',    'Ropa',            '#DDA0DD', 'shirt',              'expense'),
      ('cat_education',  'Educación',       '#54A0FF', 'school',             'expense'),
      ('cat_services',   'Servicios',       '#F7DC6F', 'flash',              'expense'),
      ('cat_other_exp',  'Otros',           '#BDC3C7', 'ellipsis-horizontal','expense'),
      ('cat_salary',     'Salario',         '#27AE60', 'cash',               'income'),
      ('cat_freelance',  'Freelance',       '#2ECC71', 'laptop',             'income'),
      ('cat_invest',     'Inversión',       '#16A085', 'trending-up',        'income'),
      ('cat_gift',       'Regalo',          '#8E44AD', 'gift',               'income'),
      ('cat_other_inc',  'Otros ingresos',  '#1ABC9C', 'add-circle',         'income');
  `);
}

// ── IPC: database ─────────────────────────────────────────────────────────────

ipcMain.handle('db:exec', (_event, sql) => {
  db.exec(sql);
});

ipcMain.handle('db:run', (_event, sql, params) => {
  db.prepare(sql).run(...(params || []));
});

ipcMain.handle('db:getAll', (_event, sql, params) => {
  return db.prepare(sql).all(...(params || []));
});

ipcMain.handle('db:getFirst', (_event, sql, params) => {
  return db.prepare(sql).get(...(params || [])) ?? null;
});

// ── IPC: file system (backup) ─────────────────────────────────────────────────

ipcMain.handle('db:readAsBase64', () => {
  db.pragma('wal_checkpoint(FULL)');
  return fs.readFileSync(dbPath).toString('base64');
});

ipcMain.handle('db:writeFromBase64', (_event, base64) => {
  try {
    const buffer = Buffer.from(base64, 'base64');
    db.close();
    fs.writeFileSync(dbPath, buffer);
    initDB();
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('fs:importDB', async () => {
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
    return { error: e.message };
  }
});

ipcMain.handle('fs:exportDB', async () => {
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
    return { error: e.message };
  }
});

// ── IPC: Google OAuth (reemplaza signInWithPopup de Firebase) ─────────────────

ipcMain.handle('auth:googleOAuth', (_event, { authUrl, redirectUri }) => {
  return new Promise((resolve, reject) => {
    let handled = false;

    const authWindow = new BrowserWindow({
      width: 500,
      height: 650,
      alwaysOnTop: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
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

function getDistPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'dist')
    : path.join(__dirname, '..', 'dist');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 800,
    icon: path.join(__dirname, '../assets/images/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url: winUrl }) => {
    const isOAuth =
      winUrl.includes('accounts.google.com') ||
      winUrl.includes('firebaseapp.com/__/auth');
    if (isOAuth) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500, height: 650,
          webPreferences: { nodeIntegration: false, contextIsolation: false },
        },
      };
    }
    return { action: 'deny' };
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    win.loadURL('http://localhost:8081');
    win.webContents.openDevTools();
  } else {
    win.loadURL('app://./');
  }
}

process.on('uncaughtException', (err) => {
  const { dialog } = require('electron');
  dialog.showErrorBox('Error al iniciar Segasto', err.stack || err.message);
  app.quit();
});

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const distPath = getDistPath();
    let filePath = request.url.replace('app://./', '').replace('app://', '');
    filePath = filePath.split('?')[0].split('#')[0];
    filePath = decodeURIComponent(filePath);
    const fullPath = path.join(distPath, filePath);
    const targetPath = fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()
      ? fullPath
      : path.join(distPath, 'index.html');
    return net.fetch(url.pathToFileURL(targetPath).toString());
  });

  try {
    initDB();
  } catch (err) {
    dialog.showErrorBox('Error al iniciar la base de datos', err.stack || err.message);
    app.quit();
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err) => {
  dialog.showErrorBox('Error al iniciar Segasto', err.stack || err.message);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
