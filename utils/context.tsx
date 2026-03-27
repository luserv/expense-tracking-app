import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { db } from './db';

export const DB_NAME = 'gastos.db';

export async function initializeDatabase() {}

export interface Expense {
  expense_id: string;
  description: string;
  amount: number;
  date: string;
  category_id?: string | null;
  account_id?: string | null;
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
}

export interface MonthSummary {
  income: number;
  expense: number;
  balance: number;
}

export interface MonthRow extends MonthSummary {
  month: number;
}

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
  total_paid: number;
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

interface ExpensesContextType {
  expenses: Expense[];
  fetchExpenses: (year?: number, month?: number) => Promise<void>;
  createExpense: (data: Omit<Expense, 'expense_id'>) => Promise<Expense | null>;
  updateExpense: (id: string, data: Omit<Expense, 'expense_id'>) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<boolean>;
  getExpense: (id: string) => Promise<Expense | null>;
  getCategories: () => Promise<Category[]>;
  createCategory: (data: Omit<Category, 'category_id'>) => Promise<boolean>;
  getAccounts: () => Promise<Account[]>;
  createAccount: (name: string, currency: string) => Promise<boolean>;
  getMonthSummary: (year: number, month: number) => Promise<MonthSummary>;
  getYearSummary: (year: number) => Promise<MonthRow[]>;
  searchExpenses: (query: string) => Promise<Expense[]>;
  getLoansForMonth: (year: number, month: number) => Promise<LoanWithPerson[]>;
  getPersons: () => Promise<PersonWithTotal[]>;
  createPerson: (name: string, notes?: string) => Promise<boolean>;
  deletePerson: (id: string) => Promise<boolean>;
  getLoansByPerson: (personId: string) => Promise<Loan[]>;
  getPerson: (id: string) => Promise<Person | null>;
  createLoan: (data: Omit<Loan, 'loan_id' | 'is_paid'>) => Promise<boolean>;
  updateLoan: (id: string, data: Omit<Loan, 'loan_id' | 'is_paid' | 'person_id' | 'total_paid'>) => Promise<boolean>;
  updateLoanPaid: (id: string, isPaid: boolean) => Promise<boolean>;
  deleteLoan: (id: string) => Promise<boolean>;
  getPaymentsByLoan: (loanId: string) => Promise<Payment[]>;
  createPayment: (data: Omit<Payment, 'payment_id'>) => Promise<boolean>;
  deletePayment: (id: string) => Promise<boolean>;
}

const ExpensesContext = createContext<ExpensesContextType | undefined>(undefined);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const fetchExpenses = useCallback(async (year?: number, month?: number) => {
    try {
      let result: Expense[];
      if (year !== undefined && month !== undefined) {
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        result = await db.getAllAsync<Expense>(
          `SELECT * FROM expense WHERE date LIKE ? ORDER BY date DESC`,
          `${prefix}%`
        );
      } else {
        result = await db.getAllAsync<Expense>('SELECT * FROM expense ORDER BY date DESC');
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
        'INSERT INTO expense (expense_id, description, amount, date, category_id, account_id, notes, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id, data.description, data.amount, data.date,
        data.category_id ?? null, data.account_id ?? null,
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
        'UPDATE expense SET description = ?, amount = ?, date = ?, category_id = ?, account_id = ?, notes = ?, type = ? WHERE expense_id = ?',
        data.description, data.amount, data.date,
        data.category_id ?? null, data.account_id ?? null,
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
      await db.runAsync('DELETE FROM expense WHERE expense_id = ?', id);
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

  const getAccounts = async (): Promise<Account[]> => {
    try {
      return await db.getAllAsync<Account>('SELECT * FROM account ORDER BY name ASC');
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const createAccount = async (name: string, currency: string): Promise<boolean> => {
    try {
      const id = 'acc_' + Date.now();
      await db.runAsync(
        'INSERT INTO account (account_id, name, currency) VALUES (?, ?, ?)',
        id, name.trim(), currency
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const getMonthSummary = async (year: number, month: number): Promise<MonthSummary> => {
    try {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const rows = await db.getAllAsync<{ type: string; total: number }>(
        `SELECT type, SUM(amount) as total FROM expense WHERE date LIKE ? GROUP BY type`,
        `${prefix}%`
      );
      const income = rows.find(r => r.type === 'income')?.total ?? 0;
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
         FROM expense WHERE date LIKE ? GROUP BY month, type`,
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
  };

  const searchExpenses = useCallback(async (query: string): Promise<Expense[]> => {
    try {
      const q = `%${query}%`;
      return await db.getAllAsync<Expense>(
        `SELECT * FROM expense WHERE description LIKE ? OR notes LIKE ? ORDER BY date DESC`,
        q, q
      );
    } catch (e) {
      console.error(e);
      return [];
    }
  }, []);

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
      return await db.getAllAsync<PersonWithTotal>(
        `SELECT p.person_id, p.name, p.notes,
           COALESCE(SUM(l.amount + l.amount * COALESCE(l.interest_rate, 0) / 100.0), 0) as total_loaned,
           COALESCE(SUM(
             CASE WHEN l.is_paid = 0 THEN
               MAX(0, (l.amount + l.amount * COALESCE(l.interest_rate, 0) / 100.0) -
                   COALESCE((SELECT SUM(py.amount) FROM payment py WHERE py.loan_id = l.loan_id), 0))
             ELSE 0 END
           ), 0) as total_pending
         FROM person p LEFT JOIN loan l ON p.person_id = l.person_id
         GROUP BY p.person_id ORDER BY p.name ASC`
      );
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const createPerson = async (name: string, notes?: string): Promise<boolean> => {
    try {
      const id = 'per_' + Date.now() + Math.random().toString(36).slice(2, 6);
      await db.runAsync(
        'INSERT INTO person (person_id, name, notes) VALUES (?, ?, ?)',
        id, name.trim(), notes ?? null
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const deletePerson = async (id: string): Promise<boolean> => {
    try {
      await db.runAsync('DELETE FROM loan WHERE person_id = ?', id);
      await db.runAsync('DELETE FROM person WHERE person_id = ?', id);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const getPerson = async (id: string): Promise<Person | null> => {
    try {
      return await db.getFirstAsync<Person>('SELECT * FROM person WHERE person_id = ?', id);
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const getLoansByPerson = async (personId: string): Promise<Loan[]> => {
    try {
      return await db.getAllAsync<Loan>(
        `SELECT l.*, COALESCE((SELECT SUM(p.amount) FROM payment p WHERE p.loan_id = l.loan_id), 0) as total_paid
         FROM loan l WHERE l.person_id = ? ORDER BY l.date DESC`,
        personId
      );
    } catch (e) {
      console.error(e);
      return [];
    }
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
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const updateLoan = async (id: string, data: Omit<Loan, 'loan_id' | 'is_paid' | 'person_id'>): Promise<boolean> => {
    try {
      await db.runAsync(
        'UPDATE loan SET description = ?, amount = ?, date = ?, interest_rate = ?, interest_type = ?, months = ? WHERE loan_id = ?',
        data.description, data.amount, data.date, data.interest_rate, data.interest_type, data.months, id
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const updateLoanPaid = async (id: string, isPaid: boolean): Promise<boolean> => {
    try {
      await db.runAsync('UPDATE loan SET is_paid = ? WHERE loan_id = ?', isPaid ? 1 : 0, id);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const deleteLoan = async (id: string): Promise<boolean> => {
    try {
      await db.runAsync('DELETE FROM payment WHERE loan_id = ?', id);
      await db.runAsync('DELETE FROM loan WHERE loan_id = ?', id);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const getPaymentsByLoan = async (loanId: string): Promise<Payment[]> => {
    try {
      return await db.getAllAsync<Payment>(
        'SELECT * FROM payment WHERE loan_id = ? ORDER BY date DESC',
        loanId
      );
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const createPayment = async (data: Omit<Payment, 'payment_id'>): Promise<boolean> => {
    try {
      const id = 'pay_' + Date.now() + Math.random().toString(36).slice(2, 6);
      await db.runAsync(
        'INSERT INTO payment (payment_id, loan_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)',
        id, data.loan_id, data.amount, data.date, data.notes ?? null
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const deletePayment = async (id: string): Promise<boolean> => {
    try {
      await db.runAsync('DELETE FROM payment WHERE payment_id = ?', id);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  return (
    <ExpensesContext.Provider value={{
      expenses,
      fetchExpenses,
      createExpense,
      updateExpense,
      deleteExpense,
      getExpense,
      getCategories,
      createCategory,
      getAccounts,
      createAccount,
      getMonthSummary,
      getYearSummary,
      searchExpenses,
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
    }}>
      {children}
    </ExpensesContext.Provider>
  );
}

export function useExpenses() {
  const context = useContext(ExpensesContext);
  if (!context) {
    throw new Error('useExpenses must be used within an ExpensesProvider');
  }
  return context;
}
