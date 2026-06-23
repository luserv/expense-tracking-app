/** Tipos de dominio — Control de Gastos. Compartidos por los repos y las pantallas. */

export interface Expense {
  expense_id: string;
  description: string;
  amount: number;
  date: string;
  category_id?: string | null;
  account_id?: string | null;
  destination_account_id?: string | null; // usado en transferencias
  transfer_pair_id?: string | null;        // vincula los dos lados de una transferencia
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

export interface Person {
  person_id: string;
  name: string;
  notes?: string | null;
}

export type LoanFrequency = 'monthly' | 'biweekly' | 'weekly';

export interface Loan {
  loan_id: string;
  person_id: string;
  description: string;
  amount: number;
  date: string;
  is_paid: number;
  interest_rate: number;
  interest_type: 'simple' | 'compound';
  months: number;                       // cantidad de cuotas
  frequency?: LoanFrequency;            // periodicidad de las cuotas (default 'monthly')
  first_due_date?: string | null;       // vencimiento de la primera cuota (YYYY-MM-DD)
  total_paid?: number;                  // calculado por SQL, opcional en inputs
}

export interface Installment {
  installment_id: string;
  loan_id: string;
  number: number;          // nº de cuota (1..N)
  due_date: string;        // el día que tenía que pagar
  amount: number;          // monto esperado de la cuota
  paid_date: string | null;// el día que realmente pagó (null = impaga)
  paid_amount: number;     // lo abonado (puede ser parcial)
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

export interface PiggyBank {
  piggy_bank_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  color: string;
  notes?: string | null;
  account_id?: string | null;
}

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

export interface Tag {
  tag_id: string;
  name: string;
  color: string;
}
