/**
 * Contexto de datos — Control de Gastos
 * Lógica Firefly III: transferencias, saldos de cuentas, presupuestos,
 * alcancías, facturas recurrentes y etiquetas.
 */
import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { db } from './db';

export const DB_NAME = 'gastos.db';
export async function initializeDatabase() {}

// ── Tipos base ────────────────────────────────────────────────────────────────

export interface Expense {
  expense_id: string;
  description: string;
  amount: number;
  date: string;
  category_id?: string | null;
  account_id?: string | null;
  destination_account_id?: string | null; // usado en transferencias
  transfer_pair_id?: string | null;       // vincula los dos lados de una transferencia
  notes?: string | null;
  type: 'income' | 'expense';
}

export interface Category {
  category_id: string;
  name: string;
  color: string;
  icon?: string | null;
  type: 'income' | 'expense';
}

export interface Account {
  account_id: string;
  name: string;
  currency: string;
  account_type?: string; // 'asset' | 'liability'
}

export interface AccountWithBalance extends Account {
  balance: number;
}

export interface MonthSummary {
  income: number;
  expense: number;
  balance: number;
}

export interface MonthRow extends MonthSummary {
  month: number;
}

export interface CategoryBreakdown {
  category_id: string;
  category_name: string;
  category_color: string;
  total: number;
  type: 'income' | 'expense';
}

// ── Préstamos ────────────────────────────────────────────────────────────────

export interface Person {
  person_id: string;
  name: string;
  notes?: string | null;
}

export interface Loan {
  loan_id: string;
  person_id: string;
  description: string;
  amount: number;
  date: string;
  is_paid: number;
  interest_rate: number;
  interest_type: 'simple' | 'compound';
  months: number;
  total_paid?: number; // calculado por SQL, opcional en inputs
}

export interface PersonWithTotal extends Person {
  total_pending: number;
  total_loaned: number;
}

export interface Payment {
  payment_id: string;
  loan_id: string;
  amount: number;
  date: string;
  notes?: string | null;
}

export interface LoanWithPerson extends Loan {
  person_name: string;
}

// ── Presupuestos (Firefly: budgets) ──────────────────────────────────────────

export interface Budget {
  budget_id: string;
  category_id: string;
  amount: number;
  month: number;
  year: number;
}

export interface BudgetWithProgress extends Budget {
  category_name: string;
  category_color: string;
  spent: number;
  percentage: number; // 0-100 (puede superar 100 si se excede)
}

// ── Alcancías / metas de ahorro (Firefly: piggy banks) ──────────────────────

export interface PiggyBank {
  piggy_bank_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  color: string;
  notes?: string | null;
  account_id?: string | null;
}

// ── Facturas recurrentes (Firefly: bills) ────────────────────────────────────

export interface Bill {
  bill_id: string;
  name: string;
  amount: number;
  category_id?: string | null;
  account_id?: string | null;
  type: 'income' | 'expense';
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_date: string;
  active: number;
  notes?: string | null;
}

// ── Etiquetas (Firefly: tags) ────────────────────────────────────────────────

export interface Tag {
  tag_id: string;
  name: string;
  color: string;
}

// ── Tipo del contexto ─────────────────────────────────────────────────────────

interface ExpensesContextType {
  expenses: Expense[];

  // Transacciones
  fetchExpenses: (year?: number, month?: number) => Promise<void>;
  createExpense: (data: Omit<Expense, 'expense_id'>) => Promise<Expense | null>;
  updateExpense: (id: string, data: Omit<Expense, 'expense_id'>) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<boolean>;
  getExpense: (id: string) => Promise<Expense | null>;
  searchExpenses: (query: string) => Promise<Expense[]>;

  // Transferencias (Firefly: double-entry)
  createTransfer: (data: {
    description: string;
    amount: number;
    date: string;
    account_id: string;
    destination_account_id: string;
    notes?: string | null;
  }) => Promise<boolean>;
  updateTransfer: (pairId: string, data: {
    description: string;
    amount: number;
    date: string;
    notes?: string | null;
  }) => Promise<boolean>;

  // Categorías
  getCategories: () => Promise<Category[]>;
  createCategory: (data: Omit<Category, 'category_id'>) => Promise<boolean>;

  // Cuentas con saldo
  getAccounts: () => Promise<Account[]>;
  createAccount: (name: string, currency: string, accountType?: string) => Promise<boolean>;
  getAccountsWithBalance: () => Promise<AccountWithBalance[]>;

  // Resúmenes
  getMonthSummary: (year: number, month: number) => Promise<MonthSummary>;
  getYearSummary: (year: number) => Promise<MonthRow[]>;
  getCategoryBreakdown: (year: number, month?: number) => Promise<CategoryBreakdown[]>;

  // Préstamos
  getLoansForMonth: (year: number, month: number) => Promise<LoanWithPerson[]>;
  getPersons: () => Promise<PersonWithTotal[]>;
  createPerson: (name: string, notes?: string) => Promise<boolean>;
  deletePerson: (id: string) => Promise<boolean>;
  getLoansByPerson: (personId: string) => Promise<Loan[]>;
  getPerson: (id: string) => Promise<Person | null>;
  createLoan: (data: Omit<Loan, 'loan_id' | 'is_paid'>) => Promise<boolean>;
  updateLoan: (id: string, data: Omit<Loan, 'loan_id' | 'is_paid' | 'person_id'>) => Promise<boolean>;
  updateLoanPaid: (id: string, isPaid: boolean) => Promise<boolean>;
  deleteLoan: (id: string) => Promise<boolean>;
  getPaymentsByLoan: (loanId: string) => Promise<Payment[]>;
  createPayment: (data: Omit<Payment, 'payment_id'>) => Promise<boolean>;
  deletePayment: (id: string) => Promise<boolean>;

  // Presupuestos (Firefly: budgets)
  getBudgetsWithProgress: (year: number, month: number) => Promise<BudgetWithProgress[]>;
  setBudget: (categoryId: string, amount: number, year: number, month: number) => Promise<boolean>;
  deleteBudget: (budgetId: string) => Promise<boolean>;

  // Alcancías (Firefly: piggy banks)
  getPiggyBanks: () => Promise<PiggyBank[]>;
  createPiggyBank: (data: Omit<PiggyBank, 'piggy_bank_id'>) => Promise<boolean>;
  updatePiggyBank: (id: string, data: Omit<PiggyBank, 'piggy_bank_id'>) => Promise<boolean>;
  deletePiggyBank: (id: string) => Promise<boolean>;
  addToPiggyBank: (id: string, amount: number) => Promise<boolean>;
  withdrawFromPiggyBank: (id: string, amount: number) => Promise<boolean>;

  // Facturas recurrentes (Firefly: bills)
  getBills: () => Promise<Bill[]>;
  getDueBills: () => Promise<Bill[]>;
  createBill: (data: Omit<Bill, 'bill_id'>) => Promise<boolean>;
  updateBill: (id: string, data: Omit<Bill, 'bill_id'>) => Promise<boolean>;
  deleteBill: (id: string) => Promise<boolean>;
  payBill: (bill: Bill) => Promise<boolean>;
  skipBill: (id: string, frequency: Bill['frequency'], nextDate: string) => Promise<boolean>;

  // Etiquetas (Firefly: tags)
  getTags: () => Promise<Tag[]>;
  createTag: (name: string, color: string) => Promise<boolean>;
  deleteTag: (id: string) => Promise<boolean>;
  getTagsForExpense: (expenseId: string) => Promise<Tag[]>;
  setTagsForExpense: (expenseId: string, tagIds: string[]) => Promise<boolean>;
}

// ── Utilidades ────────────────────────────────────────────────────────────────

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

// ── Contexto ──────────────────────────────────────────────────────────────────

const ExpensesContext = createContext<ExpensesContextType | undefined>(undefined);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // ── Transacciones ────────────────────────────────────────────────────────────

  const fetchExpenses = useCallback(async (year?: number, month?: number) => {
    try {
      let result: Expense[];
      // Solo mostramos el lado "retiro" de las transferencias (type=expense + transfer_pair_id)
      // y todas las transacciones normales (transfer_pair_id IS NULL).
      const transferFilter = `(transfer_pair_id IS NULL OR type != 'income')`;
      if (year !== undefined && month !== undefined) {
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        result = await db.getAllAsync<Expense>(
          `SELECT * FROM expense WHERE date LIKE ? AND ${transferFilter} ORDER BY date DESC`,
          `${prefix}%`
        );
      } else {
        result = await db.getAllAsync<Expense>(
          `SELECT * FROM expense WHERE ${transferFilter} ORDER BY date DESC`
        );
      }
      setExpenses(result);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const createExpense = async (data: Omit<Expense, 'expense_id'>): Promise<Expense | null> => {
    try {
      const id = 'exp_' + Date.now() + Math.random().toString(36).slice(2, 6);
      await db.runAsync(
        `INSERT INTO expense
          (expense_id, description, amount, date, category_id, account_id,
           destination_account_id, transfer_pair_id, notes, type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, data.description, data.amount, data.date,
        data.category_id ?? null, data.account_id ?? null,
        data.destination_account_id ?? null, data.transfer_pair_id ?? null,
        data.notes ?? null, data.type
      );
      return { expense_id: id, ...data };
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const updateExpense = async (id: string, data: Omit<Expense, 'expense_id'>): Promise<boolean> => {
    try {
      await db.runAsync(
        `UPDATE expense SET description=?, amount=?, date=?, category_id=?,
         account_id=?, destination_account_id=?, notes=?, type=?
         WHERE expense_id=?`,
        data.description, data.amount, data.date,
        data.category_id ?? null, data.account_id ?? null,
        data.destination_account_id ?? null,
        data.notes ?? null, data.type, id
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const deleteExpense = async (id: string): Promise<boolean> => {
    try {
      // Si es parte de una transferencia, eliminar ambos lados
      const exp = await db.getFirstAsync<{ transfer_pair_id: string | null }>(
        'SELECT transfer_pair_id FROM expense WHERE expense_id = ?', id
      );
      if (exp?.transfer_pair_id) {
        await db.runAsync('DELETE FROM expense_tag WHERE expense_id IN (SELECT expense_id FROM expense WHERE transfer_pair_id = ?)', exp.transfer_pair_id);
        await db.runAsync('DELETE FROM expense WHERE transfer_pair_id = ?', exp.transfer_pair_id);
      } else {
        await db.runAsync('DELETE FROM expense_tag WHERE expense_id = ?', id);
        await db.runAsync('DELETE FROM expense WHERE expense_id = ?', id);
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const getExpense = async (id: string): Promise<Expense | null> => {
    try {
      return await db.getFirstAsync<Expense>('SELECT * FROM expense WHERE expense_id = ?', id);
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const searchExpenses = useCallback(async (query: string): Promise<Expense[]> => {
    try {
      const q = `%${query}%`;
      return await db.getAllAsync<Expense>(
        `SELECT * FROM expense
         WHERE (description LIKE ? OR notes LIKE ?)
           AND (transfer_pair_id IS NULL OR type != 'income')
         ORDER BY date DESC`,
        q, q
      );
    } catch (e) {
      console.error(e);
      return [];
    }
  }, []);

  // ── Transferencias (Firefly: double-entry) ───────────────────────────────────

  const createTransfer = async (data: {
    description: string;
    amount: number;
    date: string;
    account_id: string;
    destination_account_id: string;
    notes?: string | null;
  }): Promise<boolean> => {
    try {
      const pairId = 'trp_' + Date.now() + Math.random().toString(36).slice(2, 6);
      const id1 = 'exp_' + Date.now() + Math.random().toString(36).slice(2, 6);
      const id2 = 'exp_' + (Date.now() + 1) + Math.random().toString(36).slice(2, 6);

      // Lado retiro (expense desde cuenta origen)
      await db.runAsync(
        `INSERT INTO expense
          (expense_id, description, amount, date, account_id, destination_account_id,
           transfer_pair_id, notes, type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'expense')`,
        id1, data.description, data.amount, data.date,
        data.account_id, data.destination_account_id,
        pairId, data.notes ?? null
      );
      // Lado depósito (income a cuenta destino)
      await db.runAsync(
        `INSERT INTO expense
          (expense_id, description, amount, date, account_id, destination_account_id,
           transfer_pair_id, notes, type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'income')`,
        id2, data.description, data.amount, data.date,
        data.destination_account_id, data.account_id,
        pairId, data.notes ?? null
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const updateTransfer = async (
    pairId: string,
    data: { description: string; amount: number; date: string; notes?: string | null }
  ): Promise<boolean> => {
    try {
      await db.runAsync(
        'UPDATE expense SET description=?, amount=?, date=?, notes=? WHERE transfer_pair_id=?',
        data.description, data.amount, data.date, data.notes ?? null, pairId
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // ── Categorías ────────────────────────────────────────────────────────────────

  const createCategory = async (data: Omit<Category, 'category_id'>): Promise<boolean> => {
    try {
      const id = 'cat_' + Date.now() + Math.random().toString(36).slice(2, 5);
      await db.runAsync(
        'INSERT INTO category (category_id, name, color, icon, type) VALUES (?, ?, ?, ?, ?)',
        id, data.name.trim(), data.color, data.icon ?? null, data.type
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const getCategories = async (): Promise<Category[]> => {
    try {
      return await db.getAllAsync<Category>('SELECT * FROM category ORDER BY type ASC, name ASC');
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  // ── Cuentas ───────────────────────────────────────────────────────────────────

  const getAccounts = async (): Promise<Account[]> => {
    try {
      return await db.getAllAsync<Account>('SELECT * FROM account ORDER BY name ASC');
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const createAccount = async (name: string, currency: string, accountType = 'asset'): Promise<boolean> => {
    try {
      const id = 'acc_' + Date.now();
      await db.runAsync(
        'INSERT INTO account (account_id, name, currency, account_type) VALUES (?, ?, ?, ?)',
        id, name.trim(), currency, accountType
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  /** Retorna cada cuenta con su saldo calculado desde las transacciones. */
  const getAccountsWithBalance = async (): Promise<AccountWithBalance[]> => {
    try {
      return await db.getAllAsync<AccountWithBalance>(`
        SELECT a.*,
          COALESCE(SUM(
            CASE WHEN e.type = 'income' THEN e.amount ELSE -e.amount END
          ), 0) AS balance
        FROM account a
        LEFT JOIN expense e ON a.account_id = e.account_id
        GROUP BY a.account_id
        ORDER BY a.name ASC
      `);
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  // ── Resúmenes (excluye transferencias del cálculo de ingresos/gastos) ─────────

  const getMonthSummary = async (year: number, month: number): Promise<MonthSummary> => {
    try {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const rows = await db.getAllAsync<{ type: string; total: number }>(
        `SELECT type, SUM(amount) as total
         FROM expense
         WHERE date LIKE ? AND transfer_pair_id IS NULL
         GROUP BY type`,
        `${prefix}%`
      );
      const income  = rows.find(r => r.type === 'income')?.total  ?? 0;
      const expense = rows.find(r => r.type === 'expense')?.total ?? 0;
      return { income, expense, balance: income - expense };
    } catch (e) {
      console.error(e);
      return { income: 0, expense: 0, balance: 0 };
    }
  };

  const getYearSummary = async (year: number): Promise<MonthRow[]> => {
    try {
      const rows = await db.getAllAsync<{ month: number; type: string; total: number }>(
        `SELECT CAST(strftime('%m', date) AS INTEGER) as month, type, SUM(amount) as total
         FROM expense
         WHERE date LIKE ? AND transfer_pair_id IS NULL
         GROUP BY month, type`,
        `${year}%`
      );
      return Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const income  = rows.find(r => r.month === m && r.type === 'income')?.total  ?? 0;
        const expense = rows.find(r => r.month === m && r.type === 'expense')?.total ?? 0;
        return { month: m, income, expense, balance: income - expense };
      });
    } catch (e) {
      console.error(e);
      return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0, balance: 0 }));
    }
  };

  /** Desglose por categoría para un año (y mes opcional). Solo gastos, sin transferencias. */
  const getCategoryBreakdown = async (year: number, month?: number): Promise<CategoryBreakdown[]> => {
    try {
      const pattern = month
        ? `${year}-${String(month).padStart(2, '0')}%`
        : `${year}%`;
      return await db.getAllAsync<CategoryBreakdown>(`
        SELECT c.category_id, c.name AS category_name, c.color AS category_color,
               e.type, SUM(e.amount) AS total
        FROM expense e
        JOIN category c ON e.category_id = c.category_id
        WHERE e.date LIKE ? AND e.transfer_pair_id IS NULL AND e.category_id IS NOT NULL
        GROUP BY c.category_id, e.type
        ORDER BY total DESC
      `, pattern);
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  // ── Préstamos ─────────────────────────────────────────────────────────────────

  const getLoansForMonth = async (year: number, month: number): Promise<LoanWithPerson[]> => {
    try {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return await db.getAllAsync<LoanWithPerson>(
        `SELECT l.*, p.name as person_name FROM loan l
         JOIN person p ON l.person_id = p.person_id
         WHERE l.date LIKE ? ORDER BY l.date DESC`,
        `${prefix}%`
      );
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const getPersons = async (): Promise<PersonWithTotal[]> => {
    try {
      return await db.getAllAsync<PersonWithTotal>(`
        SELECT p.person_id, p.name, p.notes,
          COALESCE(SUM(l.amount + l.amount * COALESCE(l.interest_rate, 0) / 100.0), 0) as total_loaned,
          COALESCE(SUM(
            CASE WHEN l.is_paid = 0 THEN
              MAX(0, (l.amount + l.amount * COALESCE(l.interest_rate, 0) / 100.0) -
                  COALESCE((SELECT SUM(py.amount) FROM payment py WHERE py.loan_id = l.loan_id), 0))
            ELSE 0 END
          ), 0) as total_pending
        FROM person p LEFT JOIN loan l ON p.person_id = l.person_id
        GROUP BY p.person_id ORDER BY p.name ASC
      `);
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const createPerson = async (name: string, notes?: string): Promise<boolean> => {
    try {
      const id = 'per_' + Date.now() + Math.random().toString(36).slice(2, 6);
      await db.runAsync('INSERT INTO person (person_id, name, notes) VALUES (?, ?, ?)', id, name.trim(), notes ?? null);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const deletePerson = async (id: string): Promise<boolean> => {
    try {
      await db.runAsync('DELETE FROM loan WHERE person_id = ?', id);
      await db.runAsync('DELETE FROM person WHERE person_id = ?', id);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const getPerson = async (id: string): Promise<Person | null> => {
    try {
      return await db.getFirstAsync<Person>('SELECT * FROM person WHERE person_id = ?', id);
    } catch (e) { console.error(e); return null; }
  };

  const getLoansByPerson = async (personId: string): Promise<Loan[]> => {
    try {
      return await db.getAllAsync<Loan>(`
        SELECT l.*, COALESCE((SELECT SUM(p.amount) FROM payment p WHERE p.loan_id = l.loan_id), 0) as total_paid
        FROM loan l WHERE l.person_id = ? ORDER BY l.date DESC
      `, personId);
    } catch (e) { console.error(e); return []; }
  };

  const createLoan = async (data: Omit<Loan, 'loan_id' | 'is_paid'>): Promise<boolean> => {
    try {
      const id = 'loan_' + Date.now() + Math.random().toString(36).slice(2, 6);
      await db.runAsync(
        'INSERT INTO loan (loan_id, person_id, description, amount, date, is_paid, interest_rate, interest_type, months) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)',
        id, data.person_id, data.description, data.amount, data.date,
        data.interest_rate ?? 0, data.interest_type ?? 'simple', data.months ?? 1
      );
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const updateLoan = async (id: string, data: Omit<Loan, 'loan_id' | 'is_paid' | 'person_id'>): Promise<boolean> => {
    try {
      await db.runAsync(
        'UPDATE loan SET description=?, amount=?, date=?, interest_rate=?, interest_type=?, months=? WHERE loan_id=?',
        data.description, data.amount, data.date, data.interest_rate, data.interest_type, data.months, id
      );
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const updateLoanPaid = async (id: string, isPaid: boolean): Promise<boolean> => {
    try {
      await db.runAsync('UPDATE loan SET is_paid=? WHERE loan_id=?', isPaid ? 1 : 0, id);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const deleteLoan = async (id: string): Promise<boolean> => {
    try {
      await db.runAsync('DELETE FROM payment WHERE loan_id=?', id);
      await db.runAsync('DELETE FROM loan WHERE loan_id=?', id);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const getPaymentsByLoan = async (loanId: string): Promise<Payment[]> => {
    try {
      return await db.getAllAsync<Payment>('SELECT * FROM payment WHERE loan_id=? ORDER BY date DESC', loanId);
    } catch (e) { console.error(e); return []; }
  };

  const createPayment = async (data: Omit<Payment, 'payment_id'>): Promise<boolean> => {
    try {
      const id = 'pay_' + Date.now() + Math.random().toString(36).slice(2, 6);
      await db.runAsync(
        'INSERT INTO payment (payment_id, loan_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)',
        id, data.loan_id, data.amount, data.date, data.notes ?? null
      );
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const deletePayment = async (id: string): Promise<boolean> => {
    try {
      await db.runAsync('DELETE FROM payment WHERE payment_id=?', id);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  // ── Presupuestos (Firefly: budgets) ──────────────────────────────────────────

  const getBudgetsWithProgress = async (year: number, month: number): Promise<BudgetWithProgress[]> => {
    try {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return await db.getAllAsync<BudgetWithProgress>(`
        SELECT b.*, c.name AS category_name, c.color AS category_color,
          COALESCE((
            SELECT SUM(e.amount) FROM expense e
            WHERE e.category_id = b.category_id
              AND e.date LIKE ?
              AND e.type = 'expense'
              AND e.transfer_pair_id IS NULL
          ), 0) AS spent,
          ROUND(COALESCE((
            SELECT SUM(e.amount) FROM expense e
            WHERE e.category_id = b.category_id
              AND e.date LIKE ?
              AND e.type = 'expense'
              AND e.transfer_pair_id IS NULL
          ), 0) * 100.0 / b.amount, 1) AS percentage
        FROM budget b
        JOIN category c ON b.category_id = c.category_id
        WHERE b.year = ? AND b.month = ?
        ORDER BY c.name ASC
      `, `${prefix}%`, `${prefix}%`, year, month);
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const setBudget = async (categoryId: string, amount: number, year: number, month: number): Promise<boolean> => {
    try {
      // Upsert: actualiza si ya existe, inserta si no
      const existing = await db.getFirstAsync<{ budget_id: string }>(
        'SELECT budget_id FROM budget WHERE category_id=? AND year=? AND month=?',
        categoryId, year, month
      );
      if (existing) {
        await db.runAsync('UPDATE budget SET amount=? WHERE budget_id=?', amount, existing.budget_id);
      } else {
        const id = 'bud_' + Date.now() + Math.random().toString(36).slice(2, 5);
        await db.runAsync(
          'INSERT INTO budget (budget_id, category_id, amount, month, year) VALUES (?, ?, ?, ?, ?)',
          id, categoryId, amount, month, year
        );
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const deleteBudget = async (budgetId: string): Promise<boolean> => {
    try {
      await db.runAsync('DELETE FROM budget WHERE budget_id=?', budgetId);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  // ── Alcancías (Firefly: piggy banks) ─────────────────────────────────────────

  const getPiggyBanks = async (): Promise<PiggyBank[]> => {
    try {
      return await db.getAllAsync<PiggyBank>('SELECT * FROM piggy_bank ORDER BY name ASC');
    } catch (e) { console.error(e); return []; }
  };

  const createPiggyBank = async (data: Omit<PiggyBank, 'piggy_bank_id'>): Promise<boolean> => {
    try {
      const id = 'pig_' + Date.now() + Math.random().toString(36).slice(2, 6);
      await db.runAsync(
        'INSERT INTO piggy_bank (piggy_bank_id, name, target_amount, current_amount, color, notes, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id, data.name.trim(), data.target_amount, data.current_amount ?? 0,
        data.color ?? '#007AFF', data.notes ?? null, data.account_id ?? null
      );
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const updatePiggyBank = async (id: string, data: Omit<PiggyBank, 'piggy_bank_id'>): Promise<boolean> => {
    try {
      await db.runAsync(
        'UPDATE piggy_bank SET name=?, target_amount=?, current_amount=?, color=?, notes=?, account_id=? WHERE piggy_bank_id=?',
        data.name.trim(), data.target_amount, data.current_amount,
        data.color, data.notes ?? null, data.account_id ?? null, id
      );
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const deletePiggyBank = async (id: string): Promise<boolean> => {
    try {
      await db.runAsync('DELETE FROM piggy_bank WHERE piggy_bank_id=?', id);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const addToPiggyBank = async (id: string, amount: number): Promise<boolean> => {
    try {
      await db.runAsync(
        'UPDATE piggy_bank SET current_amount = MIN(current_amount + ?, target_amount) WHERE piggy_bank_id=?',
        amount, id
      );
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const withdrawFromPiggyBank = async (id: string, amount: number): Promise<boolean> => {
    try {
      await db.runAsync(
        'UPDATE piggy_bank SET current_amount = MAX(0, current_amount - ?) WHERE piggy_bank_id=?',
        amount, id
      );
      return true;
    } catch (e) { console.error(e); return false; }
  };

  // ── Facturas recurrentes (Firefly: bills) ─────────────────────────────────────

  const getBills = async (): Promise<Bill[]> => {
    try {
      return await db.getAllAsync<Bill>('SELECT * FROM bill ORDER BY next_date ASC');
    } catch (e) { console.error(e); return []; }
  };

  /** Facturas activas con next_date dentro de los próximos 7 días (o ya vencidas). */
  const getDueBills = async (): Promise<Bill[]> => {
    try {
      const today = todayIso();
      const d = new Date(today + 'T12:00:00');
      d.setDate(d.getDate() + 7);
      const limit = d.toISOString().slice(0, 10);
      return await db.getAllAsync<Bill>(
        "SELECT * FROM bill WHERE active=1 AND next_date <= ? ORDER BY next_date ASC",
        limit
      );
    } catch (e) { console.error(e); return []; }
  };

  const createBill = async (data: Omit<Bill, 'bill_id'>): Promise<boolean> => {
    try {
      const id = 'bil_' + Date.now() + Math.random().toString(36).slice(2, 6);
      await db.runAsync(
        'INSERT INTO bill (bill_id, name, amount, category_id, account_id, type, frequency, next_date, active, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, data.name.trim(), data.amount,
        data.category_id ?? null, data.account_id ?? null,
        data.type, data.frequency, data.next_date,
        data.active ?? 1, data.notes ?? null
      );
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const updateBill = async (id: string, data: Omit<Bill, 'bill_id'>): Promise<boolean> => {
    try {
      await db.runAsync(
        'UPDATE bill SET name=?, amount=?, category_id=?, account_id=?, type=?, frequency=?, next_date=?, active=?, notes=? WHERE bill_id=?',
        data.name.trim(), data.amount,
        data.category_id ?? null, data.account_id ?? null,
        data.type, data.frequency, data.next_date,
        data.active, data.notes ?? null, id
      );
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const deleteBill = async (id: string): Promise<boolean> => {
    try {
      await db.runAsync('DELETE FROM bill WHERE bill_id=?', id);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  /** Crea la transacción correspondiente y avanza la próxima fecha. */
  const payBill = async (bill: Bill): Promise<boolean> => {
    try {
      const expId = 'exp_' + Date.now() + Math.random().toString(36).slice(2, 6);
      await db.runAsync(
        `INSERT INTO expense (expense_id, description, amount, date, category_id, account_id, notes, type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        expId, bill.name, bill.amount, todayIso(),
        bill.category_id ?? null, bill.account_id ?? null,
        bill.notes ?? null, bill.type
      );
      const next = advanceDate(bill.next_date, bill.frequency);
      await db.runAsync('UPDATE bill SET next_date=? WHERE bill_id=?', next, bill.bill_id);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  /** Solo avanza la fecha sin crear transacción. */
  const skipBill = async (id: string, frequency: Bill['frequency'], nextDate: string): Promise<boolean> => {
    try {
      const next = advanceDate(nextDate, frequency);
      await db.runAsync('UPDATE bill SET next_date=? WHERE bill_id=?', next, id);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  // ── Etiquetas (Firefly: tags) ─────────────────────────────────────────────────

  const getTags = async (): Promise<Tag[]> => {
    try {
      return await db.getAllAsync<Tag>('SELECT * FROM tag ORDER BY name ASC');
    } catch (e) { console.error(e); return []; }
  };

  const createTag = async (name: string, color: string): Promise<boolean> => {
    try {
      const id = 'tag_' + Date.now() + Math.random().toString(36).slice(2, 5);
      await db.runAsync('INSERT INTO tag (tag_id, name, color) VALUES (?, ?, ?)', id, name.trim(), color);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const deleteTag = async (id: string): Promise<boolean> => {
    try {
      await db.runAsync('DELETE FROM expense_tag WHERE tag_id=?', id);
      await db.runAsync('DELETE FROM tag WHERE tag_id=?', id);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const getTagsForExpense = async (expenseId: string): Promise<Tag[]> => {
    try {
      return await db.getAllAsync<Tag>(
        'SELECT t.* FROM tag t JOIN expense_tag et ON t.tag_id = et.tag_id WHERE et.expense_id=? ORDER BY t.name ASC',
        expenseId
      );
    } catch (e) { console.error(e); return []; }
  };

  /** Reemplaza todas las etiquetas de una transacción. */
  const setTagsForExpense = async (expenseId: string, tagIds: string[]): Promise<boolean> => {
    try {
      await db.runAsync('DELETE FROM expense_tag WHERE expense_id=?', expenseId);
      for (const tagId of tagIds) {
        await db.runAsync(
          'INSERT OR IGNORE INTO expense_tag (expense_id, tag_id) VALUES (?, ?)',
          expenseId, tagId
        );
      }
      return true;
    } catch (e) { console.error(e); return false; }
  };

  // ── Provider ──────────────────────────────────────────────────────────────────

  return (
    <ExpensesContext.Provider value={{
      expenses,
      fetchExpenses,
      createExpense,
      updateExpense,
      deleteExpense,
      getExpense,
      searchExpenses,
      createTransfer,
      updateTransfer,
      getCategories,
      createCategory,
      getAccounts,
      createAccount,
      getAccountsWithBalance,
      getMonthSummary,
      getYearSummary,
      getCategoryBreakdown,
      getLoansForMonth,
      getPersons,
      createPerson,
      deletePerson,
      getPerson,
      getLoansByPerson,
      createLoan,
      updateLoan,
      updateLoanPaid,
      deleteLoan,
      getPaymentsByLoan,
      createPayment,
      deletePayment,
      getBudgetsWithProgress,
      setBudget,
      deleteBudget,
      getPiggyBanks,
      createPiggyBank,
      updatePiggyBank,
      deletePiggyBank,
      addToPiggyBank,
      withdrawFromPiggyBank,
      getBills,
      getDueBills,
      createBill,
      updateBill,
      deleteBill,
      payBill,
      skipBill,
      getTags,
      createTag,
      deleteTag,
      getTagsForExpense,
      setTagsForExpense,
    }}>
      {children}
    </ExpensesContext.Provider>
  );
}

export function useExpenses() {
  const context = useContext(ExpensesContext);
  if (!context) throw new Error('useExpenses must be used within an ExpensesProvider');
  return context;
}
