/** Repo de cuotas (installments). Programación de pagos con vencimiento y atraso. */
import { db } from '../db';
import type { Installment, LoanFrequency } from './types';

/**
 * ID determinista de cuota: ins_<loanId>_<número>. Clave para la sincronización:
 * dos dispositivos que generan/migran el mismo préstamo producen los MISMOS IDs,
 * así el merge los deduplica en vez de crear cuotas repetidas.
 */
function installmentId(loanId: string, number: number): string {
  return `ins_${loanId}_${number}`;
}

/** Avanza una fecha YYYY-MM-DD según la frecuencia, k períodos. */
export function advanceByFreq(dateStr: string, freq: LoanFrequency, k: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (freq === 'weekly') d.setDate(d.getDate() + 7 * k);
  else if (freq === 'biweekly') d.setDate(d.getDate() + 14 * k);
  else d.setMonth(d.getMonth() + k); // monthly
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula montos efectivos con arrastre de deuda vencida parcialmente pagada.
 * Si una cuota venció y tiene pago parcial (> 0 pero < monto), el saldo restante
 * se suma al monto de la siguiente cuota para reflejar lo que el deudor realmente debe.
 */
export function computeEffectiveAmounts(installments: Installment[], today: string): Installment[] {
  let carry = 0;
  return installments.map(inst => {
    const effectiveAmount = Math.round((inst.amount + carry) * 100) / 100;
    const isOverdue = inst.due_date < today;
    const hasPartial = inst.paid_amount > 0 && inst.paid_amount < inst.amount;
    const remaining = Math.max(0, Math.round((effectiveAmount - inst.paid_amount) * 100) / 100);
    carry = isOverdue && hasPartial ? remaining : 0;
    return { ...inst, amount: effectiveAmount };
  });
}

/** Reparte un total en n cuotas iguales (la última absorbe el redondeo). */
export function splitAmounts(total: number, n: number): number[] {
  const per = Math.round((total / n) * 100) / 100;
  const arr = Array<number>(n).fill(per);
  arr[n - 1] = Math.round((total - per * (n - 1)) * 100) / 100;
  return arr;
}

/** Genera las n cuotas de un préstamo (cuotas iguales, vencimientos según frecuencia). */
export async function createInstallmentsForLoan(
  loanId: string, total: number, n: number, firstDue: string, freq: LoanFrequency
): Promise<void> {
  const amounts = splitAmounts(total, Math.max(1, n));
  const ts = Date.now();
  for (let i = 0; i < amounts.length; i++) {
    await db.runAsync(
      `INSERT OR IGNORE INTO installment
        (installment_id, loan_id, number, due_date, amount, paid_date, paid_amount, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, NULL, 0, ?, 0)`,
      installmentId(loanId, i + 1), loanId, i + 1, advanceByFreq(firstDue, freq, i), amounts[i], ts
    );
  }
}

/**
 * Regenera el cronograma de un préstamo (al editarlo): recalcula vencimientos y
 * montos, PERO conserva lo ya pagado en cada número de cuota. Las cuotas sobrantes
 * (si se redujo la cantidad) se marcan borradas.
 */
export async function regenerateSchedule(
  loanId: string, total: number, n: number, firstDue: string, freq: LoanFrequency
): Promise<void> {
  const count = Math.max(1, n);
  const amounts = splitAmounts(total, count);
  const ts = Date.now();
  for (let i = 0; i < count; i++) {
    const num = i + 1;
    await db.runAsync(
      `INSERT INTO installment
        (installment_id, loan_id, number, due_date, amount, paid_date, paid_amount, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, NULL, 0, ?, 0)
       ON CONFLICT(installment_id) DO UPDATE SET
         due_date=excluded.due_date, amount=excluded.amount, deleted=0, updated_at=excluded.updated_at`,
      installmentId(loanId, num), loanId, num, advanceByFreq(firstDue, freq, i), amounts[i], ts
    );
  }
  // Cuotas que ya no existen (si se redujo la cantidad).
  await db.runAsync(
    'UPDATE installment SET deleted=1, updated_at=? WHERE loan_id=? AND number > ? AND deleted=0',
    ts, loanId, count
  );
  await recomputeLoanPaid(loanId);
}

export async function getInstallments(loanId: string): Promise<Installment[]> {
  try {
    return await db.getAllAsync<Installment>(
      'SELECT * FROM installment WHERE loan_id=? AND deleted=0 ORDER BY number ASC', loanId
    );
  } catch (e) { console.error(e); return []; }
}

/** Recalcula loan.is_paid: pagado cuando toda cuota tiene paid_amount >= amount. */
async function recomputeLoanPaid(loanId: string): Promise<void> {
  const row = await db.getFirstAsync<{ total: number; paid: number }>(
    `SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN paid_amount >= amount THEN 1 ELSE 0 END), 0) paid
     FROM installment WHERE loan_id=? AND deleted=0`, loanId
  );
  const isPaid = row && row.total > 0 && row.paid === row.total ? 1 : 0;
  await db.runAsync('UPDATE loan SET is_paid=?, updated_at=? WHERE loan_id=?', isPaid, Date.now(), loanId);
}

/** Registra el pago (total o parcial) de una cuota en una fecha real. */
export async function payInstallment(installmentId: string, paidAmount: number, paidDate: string): Promise<boolean> {
  try {
    await db.runAsync(
      'UPDATE installment SET paid_amount=?, paid_date=?, updated_at=? WHERE installment_id=?',
      paidAmount, paidDate, Date.now(), installmentId
    );
    const r = await db.getFirstAsync<{ loan_id: string }>('SELECT loan_id FROM installment WHERE installment_id=?', installmentId);
    if (r) await recomputeLoanPaid(r.loan_id);
    return true;
  } catch (e) { console.error(e); return false; }
}

/**
 * Pago en cascada: aplica `amount` empezando en la cuota dada y vuelca el excedente
 * a las siguientes (saltando las ya saldadas), sin pisar lo ya pagado. Útil cuando
 * se abona más que el valor de una cuota: llena ésta y avanza. Si sobra tras la
 * última cuota, el remanente queda en la última.
 */
export async function payInstallmentCascade(installmentId: string, amount: number, paidDate: string): Promise<boolean> {
  try {
    const target = await db.getFirstAsync<{ loan_id: string; number: number }>(
      'SELECT loan_id, number FROM installment WHERE installment_id=?', installmentId
    );
    if (!target) return false;

    const list = await db.getAllAsync<{ installment_id: string; amount: number; paid_amount: number }>(
      'SELECT installment_id, amount, paid_amount FROM installment WHERE loan_id=? AND number>=? AND deleted=0 ORDER BY number ASC',
      target.loan_id, target.number
    );

    let remaining = amount;
    const ts = Date.now();

    for (const inst of list) {
      const space = Math.round((inst.amount - inst.paid_amount) * 100) / 100;
      if (space <= 0) continue; // cuota ya saldada → saltar
      const give = Math.min(remaining, space);
      if (give <= 0) break;
      const newPaid = Math.round((inst.paid_amount + give) * 100) / 100;
      await db.runAsync(
        'UPDATE installment SET paid_amount=?, paid_date=?, updated_at=? WHERE installment_id=?',
        newPaid, paidDate, ts, inst.installment_id
      );
      remaining = Math.round((remaining - give) * 100) / 100;
      if (remaining <= 0) break;
    }
    // Si sobra (pagó más que lo pendiente), el excedente se descarta: no se puede
    // deber menos de cero. Así ninguna cuota queda sobrepagada.

    await recomputeLoanPaid(target.loan_id);
    return true;
  } catch (e) { console.error(e); return false; }
}

/** Revierte el pago de una cuota (vuelve a impaga). */
export async function unpayInstallment(installmentId: string): Promise<boolean> {
  try {
    await db.runAsync(
      'UPDATE installment SET paid_amount=0, paid_date=NULL, updated_at=? WHERE installment_id=?',
      Date.now(), installmentId
    );
    const r = await db.getFirstAsync<{ loan_id: string }>('SELECT loan_id FROM installment WHERE installment_id=?', installmentId);
    if (r) await recomputeLoanPaid(r.loan_id);
    return true;
  } catch (e) { console.error(e); return false; }
}

/**
 * Migración idempotente: genera las cuotas de los préstamos que aún no las tienen,
 * repartiendo lo ya pagado (de la tabla `payment`) entre las primeras cuotas.
 * No borra los pagos previos; solo poblará las cuotas como nueva fuente de verdad.
 */
export async function migrateLoansToInstallments(): Promise<void> {
  try {
    const loans = await db.getAllAsync<{
      loan_id: string; amount: number; interest_rate: number; months: number;
      date: string; frequency: string | null; first_due_date: string | null;
    }>('SELECT loan_id, amount, interest_rate, months, date, frequency, first_due_date FROM loan WHERE deleted=0');

    for (const loan of loans) {
      const has = await db.getFirstAsync<{ c: number }>(
        'SELECT COUNT(*) c FROM installment WHERE loan_id=? AND deleted=0', loan.loan_id
      );
      if (has && has.c > 0) continue; // ya migrado

      const n = Math.max(1, loan.months || 1);
      const freq = (loan.frequency as LoanFrequency) || 'monthly';
      // Primera cuota: un período después de prestar (si no estaba definida).
      const firstDue = loan.first_due_date || advanceByFreq(loan.date, freq, 1);
      if (!loan.first_due_date) {
        await db.runAsync(
          'UPDATE loan SET first_due_date=?, frequency=?, updated_at=? WHERE loan_id=?',
          firstDue, freq, Date.now(), loan.loan_id
        );
      }

      const total = loan.amount + loan.amount * (loan.interest_rate || 0) / 100;
      const amounts = splitAmounts(total, n);

      const pays = await db.getAllAsync<{ amount: number; date: string }>(
        'SELECT amount, date FROM payment WHERE loan_id=? AND deleted=0 ORDER BY date ASC', loan.loan_id
      );
      let remaining = Math.round(pays.reduce((s, p) => s + p.amount, 0) * 100) / 100;
      const lastPayDate = pays.length ? pays[pays.length - 1].date : null;
      const ts = Date.now();

      for (let i = 0; i < n; i++) {
        let pa = 0, pd: string | null = null;
        if (remaining > 0) {
          pa = Math.min(amounts[i], remaining);
          remaining = Math.round((remaining - pa) * 100) / 100;
          pd = lastPayDate; // mejor proxy de fecha disponible
        }
        await db.runAsync(
          `INSERT OR IGNORE INTO installment
            (installment_id, loan_id, number, due_date, amount, paid_date, paid_amount, updated_at, deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          installmentId(loan.loan_id, i + 1), loan.loan_id, i + 1, advanceByFreq(firstDue, freq, i), amounts[i], pd, pa, ts
        );
      }
      await recomputeLoanPaid(loan.loan_id);
    }
  } catch (e) {
    console.error('[migración cuotas]', e);
  }
}
