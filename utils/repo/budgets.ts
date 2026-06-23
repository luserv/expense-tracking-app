/** Repo de presupuestos. Soft-delete + updated_at para sync. */
import { db } from '../db';
import { genId } from '../ids';
import type { BudgetWithProgress } from './types';

export async function getBudgetsWithProgress(year: number, month: number): Promise<BudgetWithProgress[]> {
  try {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return await db.getAllAsync<BudgetWithProgress>(`
      SELECT b.*, c.name AS category_name, c.color AS category_color,
        COALESCE((
          SELECT SUM(e.amount) FROM expense e
          WHERE e.category_id = b.category_id
            AND e.date LIKE ?
            AND e.type = 'expense'
            AND e.deleted=0
            AND e.transfer_pair_id IS NULL
        ), 0) AS spent,
        ROUND(COALESCE((
          SELECT SUM(e.amount) FROM expense e
          WHERE e.category_id = b.category_id
            AND e.date LIKE ?
            AND e.type = 'expense'
            AND e.deleted=0
            AND e.transfer_pair_id IS NULL
        ), 0) * 100.0 / b.amount, 1) AS percentage
      FROM budget b
      JOIN category c ON b.category_id = c.category_id
      WHERE b.deleted=0 AND b.year = ? AND b.month = ?
      ORDER BY c.name ASC
    `, `${prefix}%`, `${prefix}%`, year, month);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function setBudget(categoryId: string, amount: number, year: number, month: number): Promise<boolean> {
  try {
    const ts = Date.now();
    // Upsert: si ya existe (aunque esté borrado), lo revive y actualiza.
    const existing = await db.getFirstAsync<{ budget_id: string }>(
      'SELECT budget_id FROM budget WHERE category_id=? AND year=? AND month=?',
      categoryId, year, month
    );
    if (existing) {
      await db.runAsync('UPDATE budget SET amount=?, deleted=0, updated_at=? WHERE budget_id=?', amount, ts, existing.budget_id);
    } else {
      const id = genId('bud');
      await db.runAsync(
        'INSERT INTO budget (budget_id, category_id, amount, month, year, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)',
        id, categoryId, amount, month, year, ts
      );
    }
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function deleteBudget(budgetId: string): Promise<boolean> {
  try {
    await db.runAsync('UPDATE budget SET deleted=1, updated_at=? WHERE budget_id=?', Date.now(), budgetId);
    return true;
  } catch (e) { console.error(e); return false; }
}
