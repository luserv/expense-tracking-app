/** Repo de transacciones, transferencias y resúmenes. Soft-delete + updated_at para sync. */
import { db } from '../db';
import { genId } from '../ids';
import type {
  CategoryBreakdown, Expense, MonthRow, MonthSummary,
} from './types';

// Solo el lado "retiro" de las transferencias + transacciones normales.
const TRANSFER_FILTER = `(transfer_pair_id IS NULL OR type != 'income')`;

export async function queryExpenses(year?: number, month?: number): Promise<Expense[]> {
  try {
    if (year !== undefined && month !== undefined) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return await db.getAllAsync<Expense>(
        `SELECT * FROM expense WHERE deleted=0 AND date LIKE ? AND ${TRANSFER_FILTER} ORDER BY date DESC`,
        `${prefix}%`
      );
    }
    return await db.getAllAsync<Expense>(
      `SELECT * FROM expense WHERE deleted=0 AND ${TRANSFER_FILTER} ORDER BY date DESC`
    );
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function createExpense(data: Omit<Expense, 'expense_id'>): Promise<Expense | null> {
  try {
    const id = genId('exp');
    await db.runAsync(
      `INSERT INTO expense
        (expense_id, description, amount, date, category_id, account_id,
         destination_account_id, transfer_pair_id, notes, type, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      id, data.description, data.amount, data.date,
      data.category_id ?? null, data.account_id ?? null,
      data.destination_account_id ?? null, data.transfer_pair_id ?? null,
      data.notes ?? null, data.type, Date.now()
    );
    return { expense_id: id, ...data };
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function updateExpense(id: string, data: Omit<Expense, 'expense_id'>): Promise<boolean> {
  try {
    await db.runAsync(
      `UPDATE expense SET description=?, amount=?, date=?, category_id=?,
       account_id=?, destination_account_id=?, notes=?, type=?, updated_at=?
       WHERE expense_id=?`,
      data.description, data.amount, data.date,
      data.category_id ?? null, data.account_id ?? null,
      data.destination_account_id ?? null,
      data.notes ?? null, data.type, Date.now(), id
    );
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function deleteExpense(id: string): Promise<boolean> {
  try {
    const ts = Date.now();
    const exp = await db.getFirstAsync<{ transfer_pair_id: string | null }>(
      'SELECT transfer_pair_id FROM expense WHERE expense_id = ?', id
    );
    if (exp?.transfer_pair_id) {
      await db.runAsync(
        'UPDATE expense_tag SET deleted=1, updated_at=? WHERE expense_id IN (SELECT expense_id FROM expense WHERE transfer_pair_id = ?)',
        ts, exp.transfer_pair_id
      );
      await db.runAsync('UPDATE expense SET deleted=1, updated_at=? WHERE transfer_pair_id = ?', ts, exp.transfer_pair_id);
    } else {
      await db.runAsync('UPDATE expense_tag SET deleted=1, updated_at=? WHERE expense_id = ?', ts, id);
      await db.runAsync('UPDATE expense SET deleted=1, updated_at=? WHERE expense_id = ?', ts, id);
    }
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function getExpense(id: string): Promise<Expense | null> {
  try {
    return await db.getFirstAsync<Expense>('SELECT * FROM expense WHERE expense_id = ? AND deleted=0', id);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function searchExpenses(query: string): Promise<Expense[]> {
  try {
    const q = `%${query}%`;
    return await db.getAllAsync<Expense>(
      `SELECT * FROM expense
       WHERE deleted=0 AND (description LIKE ? OR notes LIKE ?)
         AND ${TRANSFER_FILTER}
       ORDER BY date DESC`,
      q, q
    );
  } catch (e) {
    console.error(e);
    return [];
  }
}

// ── Transferencias (Firefly: double-entry) ───────────────────────────────────

export async function createTransfer(data: {
  description: string;
  amount: number;
  date: string;
  account_id: string;
  destination_account_id: string;
  notes?: string | null;
}): Promise<boolean> {
  try {
    const ts = Date.now();
    const pairId = genId('trp');
    const id1 = genId('exp');
    const id2 = genId('exp');

    await db.runAsync(
      `INSERT INTO expense
        (expense_id, description, amount, date, account_id, destination_account_id,
         transfer_pair_id, notes, type, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'expense', ?, 0)`,
      id1, data.description, data.amount, data.date,
      data.account_id, data.destination_account_id,
      pairId, data.notes ?? null, ts
    );
    await db.runAsync(
      `INSERT INTO expense
        (expense_id, description, amount, date, account_id, destination_account_id,
         transfer_pair_id, notes, type, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'income', ?, 0)`,
      id2, data.description, data.amount, data.date,
      data.destination_account_id, data.account_id,
      pairId, data.notes ?? null, ts
    );
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function updateTransfer(
  pairId: string,
  data: { description: string; amount: number; date: string; notes?: string | null }
): Promise<boolean> {
  try {
    await db.runAsync(
      'UPDATE expense SET description=?, amount=?, date=?, notes=?, updated_at=? WHERE transfer_pair_id=?',
      data.description, data.amount, data.date, data.notes ?? null, Date.now(), pairId
    );
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// ── Resúmenes (excluyen transferencias y borrados) ────────────────────────────

export async function getMonthSummary(year: number, month: number): Promise<MonthSummary> {
  try {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const rows = await db.getAllAsync<{ type: string; total: number }>(
      `SELECT type, SUM(amount) as total
       FROM expense
       WHERE deleted=0 AND date LIKE ? AND transfer_pair_id IS NULL
       GROUP BY type`,
      `${prefix}%`
    );
    const income = rows.find(r => r.type === 'income')?.total ?? 0;
    const expense = rows.find(r => r.type === 'expense')?.total ?? 0;
    return { income, expense, balance: income - expense };
  } catch (e) {
    console.error(e);
    return { income: 0, expense: 0, balance: 0 };
  }
}

export async function getYearSummary(year: number): Promise<MonthRow[]> {
  try {
    const rows = await db.getAllAsync<{ month: number; type: string; total: number }>(
      `SELECT CAST(strftime('%m', date) AS INTEGER) as month, type, SUM(amount) as total
       FROM expense
       WHERE deleted=0 AND date LIKE ? AND transfer_pair_id IS NULL
       GROUP BY month, type`,
      `${year}%`
    );
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const income = rows.find(r => r.month === m && r.type === 'income')?.total ?? 0;
      const expense = rows.find(r => r.month === m && r.type === 'expense')?.total ?? 0;
      return { month: m, income, expense, balance: income - expense };
    });
  } catch (e) {
    console.error(e);
    return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0, balance: 0 }));
  }
}

export async function getCategoryBreakdown(year: number, month?: number): Promise<CategoryBreakdown[]> {
  try {
    const pattern = month ? `${year}-${String(month).padStart(2, '0')}%` : `${year}%`;
    return await db.getAllAsync<CategoryBreakdown>(`
      SELECT c.category_id, c.name AS category_name, c.color AS category_color,
             e.type, SUM(e.amount) AS total
      FROM expense e
      JOIN category c ON e.category_id = c.category_id
      WHERE e.deleted=0 AND e.date LIKE ? AND e.transfer_pair_id IS NULL AND e.category_id IS NOT NULL
      GROUP BY c.category_id, e.type
      ORDER BY total DESC
    `, pattern);
  } catch (e) {
    console.error(e);
    return [];
  }
}
