/** Repo de etiquetas. Soft-delete + updated_at para sync. */
import { db } from '../db';
import { genId } from '../ids';
import type { Tag } from './types';

export async function getTags(): Promise<Tag[]> {
  try {
    return await db.getAllAsync<Tag>('SELECT * FROM tag WHERE deleted=0 ORDER BY name ASC');
  } catch (e) { console.error(e); return []; }
}

export async function createTag(name: string, color: string): Promise<boolean> {
  try {
    const id = genId('tag');
    await db.runAsync('INSERT INTO tag (tag_id, name, color, updated_at, deleted) VALUES (?, ?, ?, ?, 0)', id, name.trim(), color, Date.now());
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function deleteTag(id: string): Promise<boolean> {
  try {
    const ts = Date.now();
    await db.runAsync('UPDATE expense_tag SET deleted=1, updated_at=? WHERE tag_id=?', ts, id);
    await db.runAsync('UPDATE tag SET deleted=1, updated_at=? WHERE tag_id=?', ts, id);
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function getTagsForExpense(expenseId: string): Promise<Tag[]> {
  try {
    return await db.getAllAsync<Tag>(
      `SELECT t.* FROM tag t
       JOIN expense_tag et ON t.tag_id = et.tag_id
       WHERE et.expense_id=? AND et.deleted=0 AND t.deleted=0 ORDER BY t.name ASC`,
      expenseId
    );
  } catch (e) { console.error(e); return []; }
}

/** Reemplaza todas las etiquetas de una transacción (soft-delete + upsert con revive). */
export async function setTagsForExpense(expenseId: string, tagIds: string[]): Promise<boolean> {
  try {
    const ts = Date.now();
    // Marcar como borradas las actuales; las seleccionadas se reviven abajo.
    await db.runAsync('UPDATE expense_tag SET deleted=1, updated_at=? WHERE expense_id=?', ts, expenseId);
    for (const tagId of tagIds) {
      await db.runAsync(
        `INSERT INTO expense_tag (expense_id, tag_id, updated_at, deleted) VALUES (?, ?, ?, 0)
         ON CONFLICT(expense_id, tag_id) DO UPDATE SET deleted=0, updated_at=excluded.updated_at`,
        expenseId, tagId, ts
      );
    }
    return true;
  } catch (e) { console.error(e); return false; }
}
