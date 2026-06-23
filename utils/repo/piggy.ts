/** Repo de alcancías / metas de ahorro. Soft-delete + updated_at para sync. */
import { db } from '../db';
import { genId } from '../ids';
import type { PiggyBank } from './types';

export async function getPiggyBanks(): Promise<PiggyBank[]> {
  try {
    return await db.getAllAsync<PiggyBank>('SELECT * FROM piggy_bank WHERE deleted=0 ORDER BY name ASC');
  } catch (e) { console.error(e); return []; }
}

export async function createPiggyBank(data: Omit<PiggyBank, 'piggy_bank_id'>): Promise<boolean> {
  try {
    const id = genId('pig');
    await db.runAsync(
      'INSERT INTO piggy_bank (piggy_bank_id, name, target_amount, current_amount, color, notes, account_id, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
      id, data.name.trim(), data.target_amount, data.current_amount ?? 0,
      data.color ?? '#007AFF', data.notes ?? null, data.account_id ?? null, Date.now()
    );
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function updatePiggyBank(id: string, data: Omit<PiggyBank, 'piggy_bank_id'>): Promise<boolean> {
  try {
    await db.runAsync(
      'UPDATE piggy_bank SET name=?, target_amount=?, current_amount=?, color=?, notes=?, account_id=?, updated_at=? WHERE piggy_bank_id=?',
      data.name.trim(), data.target_amount, data.current_amount,
      data.color, data.notes ?? null, data.account_id ?? null, Date.now(), id
    );
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function deletePiggyBank(id: string): Promise<boolean> {
  try {
    await db.runAsync('UPDATE piggy_bank SET deleted=1, updated_at=? WHERE piggy_bank_id=?', Date.now(), id);
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function addToPiggyBank(id: string, amount: number): Promise<boolean> {
  try {
    await db.runAsync(
      'UPDATE piggy_bank SET current_amount = MIN(current_amount + ?, target_amount), updated_at=? WHERE piggy_bank_id=?',
      amount, Date.now(), id
    );
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function withdrawFromPiggyBank(id: string, amount: number): Promise<boolean> {
  try {
    await db.runAsync(
      'UPDATE piggy_bank SET current_amount = MAX(0, current_amount - ?), updated_at=? WHERE piggy_bank_id=?',
      amount, Date.now(), id
    );
    return true;
  } catch (e) { console.error(e); return false; }
}
