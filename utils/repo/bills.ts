/** Repo de facturas recurrentes. Soft-delete + updated_at para sync. */
import { db } from '../db';
import { genId } from '../ids';
import type { Bill } from './types';

function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function advanceDate(dateStr: string, frequency: Bill['frequency']): string {
  const d = new Date(dateStr + 'T12:00:00');
  switch (frequency) {
    case 'daily':   d.setDate(d.getDate() + 1); break;
    case 'weekly':  d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

export async function getBills(): Promise<Bill[]> {
  try {
    return await db.getAllAsync<Bill>('SELECT * FROM bill WHERE deleted=0 ORDER BY next_date ASC');
  } catch (e) { console.error(e); return []; }
}

/** Facturas activas con next_date dentro de los próximos 7 días (o vencidas). */
export async function getDueBills(): Promise<Bill[]> {
  try {
    const today = todayIso();
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    const limit = d.toISOString().slice(0, 10);
    return await db.getAllAsync<Bill>(
      'SELECT * FROM bill WHERE deleted=0 AND active=1 AND next_date <= ? ORDER BY next_date ASC',
      limit
    );
  } catch (e) { console.error(e); return []; }
}

export async function createBill(data: Omit<Bill, 'bill_id'>): Promise<boolean> {
  try {
    const id = genId('bil');
    await db.runAsync(
      'INSERT INTO bill (bill_id, name, amount, category_id, account_id, type, frequency, next_date, active, notes, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
      id, data.name.trim(), data.amount,
      data.category_id ?? null, data.account_id ?? null,
      data.type, data.frequency, data.next_date,
      data.active ?? 1, data.notes ?? null, Date.now()
    );
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function updateBill(id: string, data: Omit<Bill, 'bill_id'>): Promise<boolean> {
  try {
    await db.runAsync(
      'UPDATE bill SET name=?, amount=?, category_id=?, account_id=?, type=?, frequency=?, next_date=?, active=?, notes=?, updated_at=? WHERE bill_id=?',
      data.name.trim(), data.amount,
      data.category_id ?? null, data.account_id ?? null,
      data.type, data.frequency, data.next_date,
      data.active, data.notes ?? null, Date.now(), id
    );
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function deleteBill(id: string): Promise<boolean> {
  try {
    await db.runAsync('UPDATE bill SET deleted=1, updated_at=? WHERE bill_id=?', Date.now(), id);
    return true;
  } catch (e) { console.error(e); return false; }
}

/** Crea la transacción correspondiente y avanza la próxima fecha. */
export async function payBill(bill: Bill): Promise<boolean> {
  try {
    const ts = Date.now();
    const expId = genId('exp');
    await db.runAsync(
      `INSERT INTO expense (expense_id, description, amount, date, category_id, account_id, notes, type, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      expId, bill.name, bill.amount, todayIso(),
      bill.category_id ?? null, bill.account_id ?? null,
      bill.notes ?? null, bill.type, ts
    );
    const next = advanceDate(bill.next_date, bill.frequency);
    await db.runAsync('UPDATE bill SET next_date=?, updated_at=? WHERE bill_id=?', next, ts, bill.bill_id);
    return true;
  } catch (e) { console.error(e); return false; }
}

/** Solo avanza la fecha sin crear transacción. */
export async function skipBill(id: string, frequency: Bill['frequency'], nextDate: string): Promise<boolean> {
  try {
    const next = advanceDate(nextDate, frequency);
    await db.runAsync('UPDATE bill SET next_date=?, updated_at=? WHERE bill_id=?', next, Date.now(), id);
    return true;
  } catch (e) { console.error(e); return false; }
}
