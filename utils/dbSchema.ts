/**
 * Esquema de base de datos — FUENTE ÚNICA compartida.
 *
 * Consumed by two runtimes:
 *   - RN/Metro (Android)   → imported by utils/dbInit.ts and utils/db.native.ts
 *   - Electron main (Node) → compiled by tsconfig.electron.json and imported by electron/main.ts
 *
 * Toda tabla lleva `updated_at` (epoch ms) y `deleted` (tombstone 0/1) para
 * habilitar la sincronización por registro (último-en-escribir-gana por fila).
 */

export const CREATE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS account (
    account_id   TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    currency     TEXT DEFAULT 'USD',
    account_type TEXT DEFAULT 'asset',
    updated_at   INTEGER NOT NULL DEFAULT 0,
    deleted      INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS category (
    category_id TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    color       TEXT DEFAULT '#007AFF',
    icon        TEXT,
    type        TEXT CHECK(type IN ('income', 'expense')) DEFAULT 'expense',
    updated_at  INTEGER NOT NULL DEFAULT 0,
    deleted     INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS expense (
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
    updated_at              INTEGER NOT NULL DEFAULT 0,
    deleted                 INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS person (
    person_id  TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    notes      TEXT,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted    INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS loan (
    loan_id       TEXT PRIMARY KEY,
    person_id     TEXT NOT NULL,
    description   TEXT NOT NULL,
    amount        REAL NOT NULL,
    date          TEXT NOT NULL,
    is_paid       INTEGER DEFAULT 0,
    interest_rate REAL    DEFAULT 0,
    interest_type TEXT    DEFAULT 'simple',
    months        INTEGER DEFAULT 1,
    updated_at    INTEGER NOT NULL DEFAULT 0,
    deleted       INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS payment (
    payment_id TEXT PRIMARY KEY,
    loan_id    TEXT NOT NULL,
    amount     REAL NOT NULL,
    date       TEXT NOT NULL,
    notes      TEXT,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted    INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS installment (
    installment_id TEXT PRIMARY KEY,
    loan_id        TEXT NOT NULL,
    number         INTEGER NOT NULL,
    due_date       TEXT NOT NULL,
    amount         REAL NOT NULL,
    paid_date      TEXT,
    paid_amount    REAL NOT NULL DEFAULT 0,
    updated_at     INTEGER NOT NULL DEFAULT 0,
    deleted        INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS budget (
    budget_id   TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    amount      REAL NOT NULL,
    month       INTEGER NOT NULL,
    year        INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL DEFAULT 0,
    deleted     INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS piggy_bank (
    piggy_bank_id  TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    target_amount  REAL NOT NULL,
    current_amount REAL DEFAULT 0,
    color          TEXT DEFAULT '#007AFF',
    notes          TEXT,
    account_id     TEXT,
    updated_at     INTEGER NOT NULL DEFAULT 0,
    deleted        INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS bill (
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
    updated_at  INTEGER NOT NULL DEFAULT 0,
    deleted     INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS tag (
    tag_id     TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    color      TEXT DEFAULT '#8E8E93',
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted    INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS expense_tag (
    expense_id TEXT NOT NULL,
    tag_id     TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (expense_id, tag_id)
  );`,
];

export const CREATE_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_expense_date     ON expense(date);`,
  `CREATE INDEX IF NOT EXISTS idx_expense_category ON expense(category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_expense_account  ON expense(account_id);`,
  `CREATE INDEX IF NOT EXISTS idx_expense_pair     ON expense(transfer_pair_id);`,
  `CREATE INDEX IF NOT EXISTS idx_expense_deleted  ON expense(deleted);`,
  `CREATE INDEX IF NOT EXISTS idx_loan_person      ON loan(person_id);`,
  `CREATE INDEX IF NOT EXISTS idx_payment_loan     ON payment(loan_id);`,
  `CREATE INDEX IF NOT EXISTS idx_installment_loan ON installment(loan_id);`,
  `CREATE INDEX IF NOT EXISTS idx_budget_period    ON budget(year, month);`,
  `CREATE INDEX IF NOT EXISTS idx_bill_next        ON bill(next_date);`,
  `CREATE INDEX IF NOT EXISTS idx_expense_tag_tag  ON expense_tag(tag_id);`,
];

// Migraciones idempotentes para instalaciones existentes (cada una va en try/catch).
export const MIGRATIONS: string[] = [
  "ALTER TABLE loan ADD COLUMN interest_rate REAL DEFAULT 0",
  "ALTER TABLE loan ADD COLUMN interest_type TEXT DEFAULT 'simple'",
  "ALTER TABLE loan ADD COLUMN months INTEGER DEFAULT 1",
  "ALTER TABLE account ADD COLUMN account_type TEXT DEFAULT 'asset'",
  "ALTER TABLE expense ADD COLUMN destination_account_id TEXT",
  "ALTER TABLE expense ADD COLUMN transfer_pair_id TEXT",
  // Cuotas: programación de pagos del préstamo.
  "ALTER TABLE loan ADD COLUMN frequency TEXT DEFAULT 'monthly'",
  "ALTER TABLE loan ADD COLUMN first_due_date TEXT",
  // Columnas de sincronización en todas las tablas.
  ...['account', 'category', 'expense', 'person', 'loan', 'payment', 'installment',
      'budget', 'piggy_bank', 'bill', 'tag', 'expense_tag'].flatMap((tbl) => [
    `ALTER TABLE ${tbl} ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE ${tbl} ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`,
  ]),
];

export const SEED: string[] = [
  `INSERT OR IGNORE INTO account (account_id, name, currency, account_type) VALUES
    ('acc_cash', 'Efectivo', 'USD', 'asset'),
    ('acc_bank', 'Banco',    'USD', 'asset');`,

  `INSERT OR IGNORE INTO category (category_id, name, color, icon, type) VALUES
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
    ('cat_other_inc',  'Otros ingresos',  '#1ABC9C', 'add-circle',         'income');`,
];

/** Lista de tablas sincronizables con su clave primaria, para el motor de merge. */
export interface SyncTable {
  table: string;
  pk: string[];
}

export const SYNC_TABLES: SyncTable[] = [
  { table: 'account',     pk: ['account_id'] },
  { table: 'category',    pk: ['category_id'] },
  { table: 'expense',     pk: ['expense_id'] },
  { table: 'person',      pk: ['person_id'] },
  { table: 'loan',        pk: ['loan_id'] },
  { table: 'payment',     pk: ['payment_id'] },
  { table: 'installment', pk: ['installment_id'] },
  { table: 'budget',      pk: ['budget_id'] },
  { table: 'piggy_bank',  pk: ['piggy_bank_id'] },
  { table: 'bill',        pk: ['bill_id'] },
  { table: 'tag',         pk: ['tag_id'] },
  { table: 'expense_tag', pk: ['expense_id', 'tag_id'] },
];

/**
 * Construye el UPSERT de merge para una tabla: inserta filas de `remote` y, en
 * caso de conflicto por PK, pisa la fila local SOLO si la remota es más nueva
 * (último-en-escribir-gana por registro). `cols` es la intersección de columnas
 * entre la DB local y la remota (robusto ante orden/versión distintos).
 */
export function buildMergeStatement(table: string, pk: string[], cols: string[]): string {
  const colList = cols.join(', ');
  const nonPk = cols.filter((c) => !pk.includes(c));
  const setClause = nonPk.map((c) => `${c}=excluded.${c}`).join(', ');
  return (
    `INSERT INTO main.${table} (${colList}) ` +
    `SELECT ${colList} FROM remote.${table} WHERE 1 ` +
    `ON CONFLICT(${pk.join(', ')}) DO UPDATE SET ${setClause} ` +
    `WHERE excluded.updated_at > ${table}.updated_at`
  );
}
