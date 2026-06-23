/** Repo de préstamos: personas, préstamos y pagos. Soft-delete + updated_at para sync. */
import { db } from '../db';
import { genId } from '../ids';
import { advanceByFreq, createInstallmentsForLoan, regenerateSchedule } from './installments';
import type { Loan, LoanWithPerson, Payment, Person, PersonWithTotal } from './types';

/** Total global pendiente de cobrar (lo que te deben): suma de saldos de cuotas impagas. */
export async function getOutstandingTotal(): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ pending: number }>(`
      SELECT COALESCE(SUM(MAX(0, i.amount - i.paid_amount)), 0) AS pending
      FROM installment i JOIN loan l ON i.loan_id = l.loan_id
      WHERE i.deleted=0 AND l.deleted=0
    `);
    return row?.pending ?? 0;
  } catch (e) {
    console.error(e);
    return 0;
  }
}

/** Total de capital prestado en un año (suma de montos de préstamos con fecha del año). */
export async function getLentInYear(year: number): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM loan WHERE deleted=0 AND date LIKE ?`,
      `${year}%`
    );
    return row?.total ?? 0;
  } catch (e) {
    console.error(e);
    return 0;
  }
}

/** Capital prestado por mes en un año. Retorna un array de 12 (índice 0 = enero). */
export async function getLentByMonth(year: number): Promise<number[]> {
  try {
    const rows = await db.getAllAsync<{ month: number; total: number }>(
      `SELECT CAST(strftime('%m', date) AS INTEGER) as month, SUM(amount) as total
       FROM loan WHERE deleted=0 AND date LIKE ? GROUP BY month`,
      `${year}%`
    );
    const out = Array<number>(12).fill(0);
    for (const r of rows) out[r.month - 1] = r.total;
    return out;
  } catch (e) {
    console.error(e);
    return Array<number>(12).fill(0);
  }
}

export async function getLoansForMonth(year: number, month: number): Promise<LoanWithPerson[]> {
  try {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return await db.getAllAsync<LoanWithPerson>(
      `SELECT l.*, p.name as person_name FROM loan l
       JOIN person p ON l.person_id = p.person_id
       WHERE l.deleted=0 AND p.deleted=0 AND l.date LIKE ? ORDER BY l.date DESC`,
      `${prefix}%`
    );
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getPersons(): Promise<PersonWithTotal[]> {
  try {
    return await db.getAllAsync<PersonWithTotal>(`
      SELECT p.person_id, p.name, p.notes,
        COALESCE((
          SELECT SUM(l.amount + l.amount * COALESCE(l.interest_rate, 0) / 100.0)
          FROM loan l WHERE l.person_id = p.person_id AND l.deleted=0
        ), 0) as total_loaned,
        COALESCE((
          SELECT SUM(MAX(0, i.amount - i.paid_amount))
          FROM installment i JOIN loan l ON i.loan_id = l.loan_id
          WHERE l.person_id = p.person_id AND l.deleted=0 AND i.deleted=0
        ), 0) as total_pending
      FROM person p
      WHERE p.deleted=0
      ORDER BY p.name ASC
    `);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function createPerson(name: string, notes?: string): Promise<boolean> {
  try {
    const id = genId('per');
    await db.runAsync(
      'INSERT INTO person (person_id, name, notes, updated_at, deleted) VALUES (?, ?, ?, ?, 0)',
      id, name.trim(), notes ?? null, Date.now()
    );
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function deletePerson(id: string): Promise<boolean> {
  try {
    const ts = Date.now();
    await db.runAsync(
      'UPDATE payment SET deleted=1, updated_at=? WHERE loan_id IN (SELECT loan_id FROM loan WHERE person_id = ?)',
      ts, id
    );
    await db.runAsync('UPDATE loan SET deleted=1, updated_at=? WHERE person_id = ?', ts, id);
    await db.runAsync('UPDATE person SET deleted=1, updated_at=? WHERE person_id = ?', ts, id);
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function getPerson(id: string): Promise<Person | null> {
  try {
    return await db.getFirstAsync<Person>('SELECT * FROM person WHERE person_id = ? AND deleted=0', id);
  } catch (e) { console.error(e); return null; }
}

export async function getLoansByPerson(personId: string): Promise<Loan[]> {
  try {
    return await db.getAllAsync<Loan>(`
      SELECT l.*, COALESCE((SELECT SUM(i.paid_amount) FROM installment i WHERE i.loan_id = l.loan_id AND i.deleted=0), 0) as total_paid
      FROM loan l WHERE l.person_id = ? AND l.deleted=0 ORDER BY l.date DESC
    `, personId);
  } catch (e) { console.error(e); return []; }
}

export async function createLoan(data: Omit<Loan, 'loan_id' | 'is_paid'>): Promise<boolean> {
  try {
    const id = genId('loan');
    const freq = data.frequency ?? 'monthly';
    const n = Math.max(1, data.months ?? 1);
    const firstDue = data.first_due_date || advanceByFreq(data.date, freq, 1);
    await db.runAsync(
      'INSERT INTO loan (loan_id, person_id, description, amount, date, is_paid, interest_rate, interest_type, months, frequency, first_due_date, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0)',
      id, data.person_id, data.description, data.amount, data.date,
      data.interest_rate ?? 0, data.interest_type ?? 'simple', n, freq, firstDue, Date.now()
    );
    const total = data.amount + data.amount * (data.interest_rate ?? 0) / 100;
    await createInstallmentsForLoan(id, total, n, firstDue, freq);
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function updateLoan(id: string, data: Omit<Loan, 'loan_id' | 'is_paid' | 'person_id'>): Promise<boolean> {
  try {
    const freq = data.frequency ?? 'monthly';
    const n = Math.max(1, data.months ?? 1);
    const firstDue = data.first_due_date || advanceByFreq(data.date, freq, 1);
    await db.runAsync(
      'UPDATE loan SET description=?, amount=?, date=?, interest_rate=?, interest_type=?, months=?, frequency=?, first_due_date=?, updated_at=? WHERE loan_id=?',
      data.description, data.amount, data.date, data.interest_rate, data.interest_type, n, freq, firstDue, Date.now(), id
    );
    const total = data.amount + data.amount * (data.interest_rate ?? 0) / 100;
    await regenerateSchedule(id, total, n, firstDue, freq);
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function updateLoanPaid(id: string, isPaid: boolean): Promise<boolean> {
  try {
    await db.runAsync('UPDATE loan SET is_paid=?, updated_at=? WHERE loan_id=?', isPaid ? 1 : 0, Date.now(), id);
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function deleteLoan(id: string): Promise<boolean> {
  try {
    const ts = Date.now();
    await db.runAsync('UPDATE payment SET deleted=1, updated_at=? WHERE loan_id=?', ts, id);
    await db.runAsync('UPDATE loan SET deleted=1, updated_at=? WHERE loan_id=?', ts, id);
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function getPaymentsByLoan(loanId: string): Promise<Payment[]> {
  try {
    return await db.getAllAsync<Payment>('SELECT * FROM payment WHERE loan_id=? AND deleted=0 ORDER BY date DESC', loanId);
  } catch (e) { console.error(e); return []; }
}

export async function createPayment(data: Omit<Payment, 'payment_id'>): Promise<boolean> {
  try {
    const id = genId('pay');
    await db.runAsync(
      'INSERT INTO payment (payment_id, loan_id, amount, date, notes, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)',
      id, data.loan_id, data.amount, data.date, data.notes ?? null, Date.now()
    );
    return true;
  } catch (e) { console.error(e); return false; }
}

export async function deletePayment(id: string): Promise<boolean> {
  try {
    await db.runAsync('UPDATE payment SET deleted=1, updated_at=? WHERE payment_id=?', Date.now(), id);
    return true;
  } catch (e) { console.error(e); return false; }
}
