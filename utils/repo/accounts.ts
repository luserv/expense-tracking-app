/** Repo de cuentas y categorías. Soft-delete + updated_at para sync. */
import { db } from '../db';
import { genId } from '../ids';
import type { Account, AccountWithBalance, Category } from './types';

// ── Categorías ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  try {
    return await db.getAllAsync<Category>('SELECT * FROM category WHERE deleted=0 ORDER BY type ASC, name ASC');
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function createCategory(data: Omit<Category, 'category_id'>): Promise<boolean> {
  try {
    const id = genId('cat');
    await db.runAsync(
      'INSERT INTO category (category_id, name, color, icon, type, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)',
      id, data.name.trim(), data.color, data.icon ?? null, data.type, Date.now()
    );
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// ── Cuentas ───────────────────────────────────────────────────────────────────

export async function getAccounts(): Promise<Account[]> {
  try {
    return await db.getAllAsync<Account>('SELECT * FROM account WHERE deleted=0 ORDER BY name ASC');
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function createAccount(name: string, currency: string, accountType = 'asset'): Promise<boolean> {
  try {
    const id = genId('acc');
    await db.runAsync(
      'INSERT INTO account (account_id, name, currency, account_type, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0)',
      id, name.trim(), currency, accountType, Date.now()
    );
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/** Cada cuenta con su saldo calculado desde las transacciones (excluye borrados). */
export async function getAccountsWithBalance(): Promise<AccountWithBalance[]> {
  try {
    return await db.getAllAsync<AccountWithBalance>(`
      SELECT a.*,
        COALESCE(SUM(
          CASE WHEN e.type = 'income' THEN e.amount ELSE -e.amount END
        ), 0) AS balance
      FROM account a
      LEFT JOIN expense e ON a.account_id = e.account_id AND e.deleted=0
      WHERE a.deleted=0
      GROUP BY a.account_id
      ORDER BY a.name ASC
    `);
  } catch (e) {
    console.error(e);
    return [];
  }
}
