/**
 * Contexto de datos — Control de Gastos.
 * Provider delgado: el acceso a datos vive en utils/repo/* (un módulo por dominio).
 * Aquí solo queda el estado de React (lista de transacciones) y la sincronización.
 */
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './authContext';
import { db } from './db';
import type { DbAdapter } from './dbTransactions';
import * as AccountsRepo from './repo/accounts';
import * as BillsRepo from './repo/bills';
import * as BudgetsRepo from './repo/budgets';
import * as ExpensesRepo from './repo/expenses';
import * as InstallmentsRepo from './repo/installments';
import * as LoansRepo from './repo/loans';
import * as PiggyRepo from './repo/piggy';
import * as TagsRepo from './repo/tags';
import type {
  Account, AccountWithBalance, Bill, BudgetWithProgress, Category, CategoryBreakdown,
  Expense, Installment, Loan, LoanWithPerson, MonthRow, MonthSummary, Payment, Person,
  PersonWithTotal, PiggyBank, Tag,
} from './repo/types';
import {
  getLastSyncAt, isAutoSyncEnabled, pullIfNeeded,
  schedulePush, setAutoSyncEnabled, syncNow as syncNowRemote,
} from './sync';

export const DB_NAME = 'gastos.db';

// Re-export de tipos para que las pantallas sigan importando desde 'utils/context'.
export type * from './repo/types';

// ── Tipo del contexto ─────────────────────────────────────────────────────────

interface ExpensesContextType {
  expenses: Expense[];

  fetchExpenses: (year?: number, month?: number) => Promise<void>;
  createExpense: (data: Omit<Expense, 'expense_id'>) => Promise<Expense | null>;
  updateExpense: (id: string, data: Omit<Expense, 'expense_id'>) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<boolean>;
  getExpense: (id: string) => Promise<Expense | null>;
  searchExpenses: (query: string) => Promise<Expense[]>;

  createTransfer: (data: {
    description: string; amount: number; date: string;
    account_id: string; destination_account_id: string; notes?: string | null;
  }) => Promise<boolean>;
  updateTransfer: (pairId: string, data: {
    description: string; amount: number; date: string; notes?: string | null;
  }) => Promise<boolean>;

  getCategories: () => Promise<Category[]>;
  createCategory: (data: Omit<Category, 'category_id'>) => Promise<boolean>;

  getAccounts: () => Promise<Account[]>;
  createAccount: (name: string, currency: string, accountType?: string) => Promise<boolean>;
  getAccountsWithBalance: () => Promise<AccountWithBalance[]>;

  getMonthSummary: (year: number, month: number) => Promise<MonthSummary>;
  getYearSummary: (year: number) => Promise<MonthRow[]>;
  getCategoryBreakdown: (year: number, month?: number) => Promise<CategoryBreakdown[]>;

  getLoansForMonth: (year: number, month: number) => Promise<LoanWithPerson[]>;
  getOutstandingTotal: () => Promise<number>;
  getLentInYear: (year: number) => Promise<number>;
  getLentByMonth: (year: number) => Promise<number[]>;
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

  // Cuotas
  getInstallments: (loanId: string) => Promise<Installment[]>;
  payInstallment: (installmentId: string, paidAmount: number, paidDate: string) => Promise<boolean>;
  payInstallmentCascade: (installmentId: string, amount: number, paidDate: string) => Promise<boolean>;
  unpayInstallment: (installmentId: string) => Promise<boolean>;

  getBudgetsWithProgress: (year: number, month: number) => Promise<BudgetWithProgress[]>;
  setBudget: (categoryId: string, amount: number, year: number, month: number) => Promise<boolean>;
  deleteBudget: (budgetId: string) => Promise<boolean>;

  getPiggyBanks: () => Promise<PiggyBank[]>;
  createPiggyBank: (data: Omit<PiggyBank, 'piggy_bank_id'>) => Promise<boolean>;
  updatePiggyBank: (id: string, data: Omit<PiggyBank, 'piggy_bank_id'>) => Promise<boolean>;
  deletePiggyBank: (id: string) => Promise<boolean>;
  addToPiggyBank: (id: string, amount: number) => Promise<boolean>;
  withdrawFromPiggyBank: (id: string, amount: number) => Promise<boolean>;

  getBills: () => Promise<Bill[]>;
  getDueBills: () => Promise<Bill[]>;
  createBill: (data: Omit<Bill, 'bill_id'>) => Promise<boolean>;
  updateBill: (id: string, data: Omit<Bill, 'bill_id'>) => Promise<boolean>;
  deleteBill: (id: string) => Promise<boolean>;
  payBill: (bill: Bill) => Promise<boolean>;
  skipBill: (id: string, frequency: Bill['frequency'], nextDate: string) => Promise<boolean>;

  getTags: () => Promise<Tag[]>;
  createTag: (name: string, color: string) => Promise<boolean>;
  deleteTag: (id: string) => Promise<boolean>;
  getTagsForExpense: (expenseId: string) => Promise<Tag[]>;
  setTagsForExpense: (expenseId: string, tagIds: string[]) => Promise<boolean>;

  // Sincronización entre dispositivos
  dbRevision: number;                 // se incrementa al importar datos remotos; las pantallas refrescan al cambiar
  syncing: boolean;
  syncEnabled: boolean;
  lastSyncAt: number | null;
  setSyncEnabled: (enabled: boolean) => Promise<void>;
  syncNow: () => Promise<{ changed: boolean; error?: string }>;
}

const ExpensesContext = createContext<ExpensesContextType | undefined>(undefined);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const fetchExpenses = useCallback(async (year?: number, month?: number) => {
    setExpenses(await ExpensesRepo.queryExpenses(year, month));
  }, []);

  // ── Estado de sincronización ──────────────────────────────────────────────────
  const { driveToken, refreshDriveToken } = useAuth();
  const tokenRef = useRef<string | null>(driveToken);
  tokenRef.current = driveToken;
  const [dbRevision, setDbRevision] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncEnabled, setSyncEnabledState] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  // Cargar preferencias persistidas al montar.
  useEffect(() => {
    (async () => {
      setSyncEnabledState(await isAutoSyncEnabled());
      setLastSyncAt(await getLastSyncAt());
    })();
  }, []);

  // Migración única: generar cuotas para préstamos que aún no las tienen (idempotente).
  useEffect(() => { void InstallmentsRepo.migrateLoansToInstallments(); }, []);

  // Tras importar datos remotos: refrescar pantallas y la lista de transacciones.
  const reloadAfterImport = useCallback(() => {
    setDbRevision(v => v + 1);
    void fetchExpenses();
  }, [fetchExpenses]);
  // The write interceptor is installed once, so it reads the latest callback via a ref.
  const reloadAfterImportRef = useRef(reloadAfterImport);
  reloadAfterImportRef.current = reloadAfterImport;

  // Interceptar escrituras una sola vez: cada runAsync o transacción programa un push diferido.
  useEffect(() => {
    const scheduleSync = () => schedulePush(() => tokenRef.current, () => reloadAfterImportRef.current());
    const origRun = db.runAsync;
    const origTransaction = db.withTransactionAsync;
    db.runAsync = (sql: string, ...params: unknown[]) => {
      const p = origRun(sql, ...params);
      p.then(scheduleSync).catch(() => {});
      return p;
    };
    db.withTransactionAsync = <T,>(work: (tx: DbAdapter) => Promise<T>) => {
      const p = origTransaction(work);
      p.then(scheduleSync).catch(() => {});
      return p;
    };
    return () => {
      db.runAsync = origRun;
      db.withTransactionAsync = origTransaction;
    };
  }, []);

  // Ejecuta una operación de Drive, refrescando el token una vez si expiró.
  const runWithToken = useCallback(async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    const token = tokenRef.current;
    if (!token) throw new Error('SIGN_IN_REQUIRED');
    try {
      return await fn(token);
    } catch (e: any) {
      if (e?.message === 'TOKEN_EXPIRED') {
        const fresh = await refreshDriveToken();
        if (!fresh) throw new Error('TOKEN_EXPIRED');
        return await fn(fresh);
      }
      throw e;
    }
  }, [refreshDriveToken]);

  const setSyncEnabled = useCallback(async (enabled: boolean) => {
    await setAutoSyncEnabled(enabled);
    setSyncEnabledState(enabled);
    if (enabled && tokenRef.current) {
      try {
        const res = await runWithToken(t => syncNowRemote(t));
        if (res.changed) reloadAfterImport();
        setLastSyncAt(await getLastSyncAt());
      } catch (e) {
        console.warn('[sync] sync inicial falló:', e);
      }
    }
  }, [runWithToken, reloadAfterImport]);

  const syncNow = useCallback(async (): Promise<{ changed: boolean; error?: string }> => {
    if (!tokenRef.current) return { changed: false, error: 'SIGN_IN_REQUIRED' };
    setSyncing(true);
    try {
      const res = await runWithToken(t => syncNowRemote(t));
      if (res.changed) reloadAfterImport();
      setLastSyncAt(await getLastSyncAt());
      return { changed: res.changed };
    } catch (e: any) {
      return { changed: false, error: e?.message ?? 'SYNC_ERROR' };
    } finally {
      setSyncing(false);
    }
  }, [runWithToken, reloadAfterImport]);

  // Pull al volver la app a primer plano (detecta cambios hechos en otro cliente).
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || !tokenRef.current) return;
      if (!(await isAutoSyncEnabled())) return;
      setSyncing(true);
      try {
        const res = await runWithToken(t => pullIfNeeded(t));
        if (res.changed) reloadAfterImport();
        setLastSyncAt(await getLastSyncAt());
      } catch (e) {
        console.warn('[sync] pull en foreground falló:', e);
      } finally {
        setSyncing(false);
      }
    });
    return () => sub.remove();
  }, [runWithToken, reloadAfterImport]);

  // Pull inicial cuando ya hay token disponible.
  useEffect(() => {
    if (!driveToken) return;
    (async () => {
      if (!(await isAutoSyncEnabled())) return;
      setSyncing(true);
      try {
        const res = await runWithToken(t => pullIfNeeded(t));
        if (res.changed) reloadAfterImport();
        setLastSyncAt(await getLastSyncAt());
      } catch (e) {
        console.warn('[sync] pull inicial falló:', e);
      } finally {
        setSyncing(false);
      }
    })();
  }, [driveToken, runWithToken, reloadAfterImport]);

  // ── Provider ──────────────────────────────────────────────────────────────────

  return (
    <ExpensesContext.Provider value={{
      expenses,
      fetchExpenses,
      createExpense: ExpensesRepo.createExpense,
      updateExpense: ExpensesRepo.updateExpense,
      deleteExpense: ExpensesRepo.deleteExpense,
      getExpense: ExpensesRepo.getExpense,
      searchExpenses: ExpensesRepo.searchExpenses,
      createTransfer: ExpensesRepo.createTransfer,
      updateTransfer: ExpensesRepo.updateTransfer,
      getCategories: AccountsRepo.getCategories,
      createCategory: AccountsRepo.createCategory,
      getAccounts: AccountsRepo.getAccounts,
      createAccount: AccountsRepo.createAccount,
      getAccountsWithBalance: AccountsRepo.getAccountsWithBalance,
      getMonthSummary: ExpensesRepo.getMonthSummary,
      getYearSummary: ExpensesRepo.getYearSummary,
      getCategoryBreakdown: ExpensesRepo.getCategoryBreakdown,
      getLoansForMonth: LoansRepo.getLoansForMonth,
      getOutstandingTotal: LoansRepo.getOutstandingTotal,
      getLentInYear: LoansRepo.getLentInYear,
      getLentByMonth: LoansRepo.getLentByMonth,
      getPersons: LoansRepo.getPersons,
      createPerson: LoansRepo.createPerson,
      deletePerson: LoansRepo.deletePerson,
      getPerson: LoansRepo.getPerson,
      getLoansByPerson: LoansRepo.getLoansByPerson,
      createLoan: LoansRepo.createLoan,
      updateLoan: LoansRepo.updateLoan,
      updateLoanPaid: LoansRepo.updateLoanPaid,
      deleteLoan: LoansRepo.deleteLoan,
      getPaymentsByLoan: LoansRepo.getPaymentsByLoan,
      createPayment: LoansRepo.createPayment,
      deletePayment: LoansRepo.deletePayment,
      getInstallments: InstallmentsRepo.getInstallments,
      payInstallment: InstallmentsRepo.payInstallment,
      payInstallmentCascade: InstallmentsRepo.payInstallmentCascade,
      unpayInstallment: InstallmentsRepo.unpayInstallment,
      getBudgetsWithProgress: BudgetsRepo.getBudgetsWithProgress,
      setBudget: BudgetsRepo.setBudget,
      deleteBudget: BudgetsRepo.deleteBudget,
      getPiggyBanks: PiggyRepo.getPiggyBanks,
      createPiggyBank: PiggyRepo.createPiggyBank,
      updatePiggyBank: PiggyRepo.updatePiggyBank,
      deletePiggyBank: PiggyRepo.deletePiggyBank,
      addToPiggyBank: PiggyRepo.addToPiggyBank,
      withdrawFromPiggyBank: PiggyRepo.withdrawFromPiggyBank,
      getBills: BillsRepo.getBills,
      getDueBills: BillsRepo.getDueBills,
      createBill: BillsRepo.createBill,
      updateBill: BillsRepo.updateBill,
      deleteBill: BillsRepo.deleteBill,
      payBill: BillsRepo.payBill,
      skipBill: BillsRepo.skipBill,
      getTags: TagsRepo.getTags,
      createTag: TagsRepo.createTag,
      deleteTag: TagsRepo.deleteTag,
      getTagsForExpense: TagsRepo.getTagsForExpense,
      setTagsForExpense: TagsRepo.setTagsForExpense,
      dbRevision,
      syncing,
      syncEnabled,
      lastSyncAt,
      setSyncEnabled,
      syncNow,
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
