/**
 * Inicialización del esquema de base de datos — Control de Gastos.
 * Compatible con expo-sqlite (native) y el adaptador IPC de Electron.
 *
 * Lógica Firefly III:
 *  - Tipos de cuenta (asset/liability)
 *  - Transferencias entre cuentas (pares vinculados por transfer_pair_id)
 *  - Presupuestos mensuales por categoría
 *  - Alcancías / metas de ahorro (piggy_bank)
 *  - Facturas recurrentes (bill)
 *  - Etiquetas (tag + expense_tag)
 */

interface MinimalDB {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<void>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
}

export async function initializeDatabase(db: MinimalDB) {
  // ── Tablas principales ───────────────────────────────────────────────────────
  await db.execAsync(`
  CREATE TABLE IF NOT EXISTS account (
    account_id   TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    currency     TEXT DEFAULT 'USD',
    account_type TEXT DEFAULT 'asset'
  );

  CREATE TABLE IF NOT EXISTS category (
    category_id TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    color       TEXT DEFAULT '#007AFF',
    icon        TEXT,
    type        TEXT CHECK(type IN ('income', 'expense')) DEFAULT 'expense'
  );

  CREATE TABLE IF NOT EXISTS expense (
    expense_id              TEXT PRIMARY KEY,
    description             TEXT NOT NULL,
    amount                  REAL NOT NULL,
    date                    TEXT NOT NULL,
    category_id             TEXT,
    account_id              TEXT,
    destination_account_id  TEXT,
    transfer_pair_id        TEXT,
    notes                   TEXT,
    type                    TEXT CHECK(type IN ('income', 'expense')) DEFAULT 'expense',
    FOREIGN KEY (category_id) REFERENCES category(category_id),
    FOREIGN KEY (account_id)  REFERENCES account(account_id)
  );
  `);

  // ── Préstamos ────────────────────────────────────────────────────────────────
  await db.execAsync(`
  CREATE TABLE IF NOT EXISTS person (
    person_id TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    notes     TEXT
  );

  CREATE TABLE IF NOT EXISTS loan (
    loan_id       TEXT PRIMARY KEY,
    person_id     TEXT NOT NULL,
    description   TEXT NOT NULL,
    amount        REAL NOT NULL,
    date          TEXT NOT NULL,
    is_paid       INTEGER DEFAULT 0,
    interest_rate REAL    DEFAULT 0,
    interest_type TEXT    DEFAULT 'simple',
    months        INTEGER DEFAULT 1,
    FOREIGN KEY (person_id) REFERENCES person(person_id)
  );

  CREATE TABLE IF NOT EXISTS payment (
    payment_id TEXT PRIMARY KEY,
    loan_id    TEXT NOT NULL,
    amount     REAL NOT NULL,
    date       TEXT NOT NULL,
    notes      TEXT,
    FOREIGN KEY (loan_id) REFERENCES loan(loan_id)
  );
  `);

  // ── Presupuestos (Firefly: budgets) ──────────────────────────────────────────
  await db.execAsync(`
  CREATE TABLE IF NOT EXISTS budget (
    budget_id   TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    amount      REAL NOT NULL,
    month       INTEGER NOT NULL,
    year        INTEGER NOT NULL,
    FOREIGN KEY (category_id) REFERENCES category(category_id)
  );
  `);

  // ── Alcancías / metas de ahorro (Firefly: piggy banks) ──────────────────────
  await db.execAsync(`
  CREATE TABLE IF NOT EXISTS piggy_bank (
    piggy_bank_id  TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    target_amount  REAL NOT NULL,
    current_amount REAL DEFAULT 0,
    color          TEXT DEFAULT '#007AFF',
    notes          TEXT,
    account_id     TEXT,
    FOREIGN KEY (account_id) REFERENCES account(account_id)
  );
  `);

  // ── Facturas recurrentes (Firefly: bills) ────────────────────────────────────
  await db.execAsync(`
  CREATE TABLE IF NOT EXISTS bill (
    bill_id     TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    amount      REAL NOT NULL,
    category_id TEXT,
    account_id  TEXT,
    type        TEXT DEFAULT 'expense',
    frequency   TEXT DEFAULT 'monthly',
    next_date   TEXT NOT NULL,
    active      INTEGER DEFAULT 1,
    notes       TEXT,
    FOREIGN KEY (category_id) REFERENCES category(category_id),
    FOREIGN KEY (account_id)  REFERENCES account(account_id)
  );
  `);

  // ── Etiquetas (Firefly: tags) ────────────────────────────────────────────────
  await db.execAsync(`
  CREATE TABLE IF NOT EXISTS tag (
    tag_id TEXT PRIMARY KEY,
    name   TEXT NOT NULL,
    color  TEXT DEFAULT '#8E8E93'
  );

  CREATE TABLE IF NOT EXISTS expense_tag (
    expense_id TEXT NOT NULL,
    tag_id     TEXT NOT NULL,
    PRIMARY KEY (expense_id, tag_id),
    FOREIGN KEY (expense_id) REFERENCES expense(expense_id),
    FOREIGN KEY (tag_id)     REFERENCES tag(tag_id)
  );
  `);

  // ── Migraciones para instalaciones existentes ────────────────────────────────
  try { await db.runAsync("ALTER TABLE loan ADD COLUMN interest_rate REAL DEFAULT 0"); } catch {}
  try { await db.runAsync("ALTER TABLE loan ADD COLUMN interest_type TEXT DEFAULT 'simple'"); } catch {}
  try { await db.runAsync("ALTER TABLE loan ADD COLUMN months INTEGER DEFAULT 1"); } catch {}
  try { await db.runAsync("ALTER TABLE account ADD COLUMN account_type TEXT DEFAULT 'asset'"); } catch {}
  try { await db.runAsync("ALTER TABLE expense ADD COLUMN destination_account_id TEXT"); } catch {}
  try { await db.runAsync("ALTER TABLE expense ADD COLUMN transfer_pair_id TEXT"); } catch {}

  // ── Cuentas predeterminadas ──────────────────────────────────────────────────
  await db.execAsync(`
  INSERT OR IGNORE INTO account (account_id, name, currency, account_type) VALUES
    ('acc_cash', 'Efectivo', 'USD', 'asset'),
    ('acc_bank', 'Banco',    'USD', 'asset');
  `);

  // ── Categorías predeterminadas ───────────────────────────────────────────────
  await db.execAsync(`
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
