import React, { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'es' | 'en';
const LANG_KEY = 'app_language';

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') { localStorage.setItem(key, value); return; }
    const SecureStore = await import('expo-secure-store');
    return SecureStore.setItemAsync(key, value);
  },
};

const translations = {
  es: {
    tabs: {
      expenses: 'Gastos',
      stats: 'Resumen',
      loans: 'Préstamos',
      config: 'Configuración',
    },
    common: {
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      add: '+ Agregar',
      back: 'Atrás',
      error: 'Error',
      required: '*',
      income: 'Ingreso',
      expense: 'Gasto',
    },
    expenses: {
      search: 'Buscar',
      empty: 'Sin transacciones',
      newExpense: 'Nueva Transacción',
      editExpense: 'Editar Transacción',
      description: 'Descripción',
      descriptionPlaceholder: 'Ej: Almuerzo, Salario...',
      amount: 'Monto',
      amountPlaceholder: '0.00',
      date: 'Fecha',
      datePlaceholder: 'DD/MM/AAAA',
      type: 'Tipo',
      category: 'Categoría',
      account: 'Cuenta',
      notes: 'Notas',
      notesPlaceholder: 'Notas adicionales...',
      descriptionRequired: 'La descripción es obligatoria',
      amountRequired: 'El monto debe ser mayor a 0',
      dateRequired: 'La fecha es obligatoria',
      createError: 'Error al crear la transacción',
      deleteConfirm: '¿Eliminar esta transacción?',
      noCategory: 'Sin categoría',
      noAccount: 'Sin cuenta',
    },
    summary: {
      income: 'Ingresos',
      expense: 'Gastos',
      balance: 'Balance',
    },
    stats: {
      title: 'Resumen',
      annual: 'Resumen anual',
      monthly: 'Por mes',
      months: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      income: 'Ingresos',
      expense: 'Gastos',
      balance: 'Balance',
      noData: 'Sin datos para este año',
    },
    config: {
      title: 'Configuración',
      database: 'Base de datos',
      databaseDesc: 'Exportá una copia de seguridad o importá una base de datos existente.',
      exportBtn: '⬆ Exportar',
      importBtn: '⬇ Importar',
      language: 'Idioma',
      languageDesc: 'Seleccioná el idioma de la aplicación.',
      exportSuccess: 'Base de datos exportada correctamente.',
      importSuccess: 'Base de datos importada. Reiniciá la app para ver los cambios.',
      importTitle: 'Importar base de datos',
      importConfirm: 'Esto reemplazará todos los datos actuales. ¿Querés continuar?',
      importSuccessTitle: 'Importación exitosa',
      importSuccessMsg: 'Reiniciá la aplicación para que los cambios tomen efecto.',
      importContinue: 'Continuar',
      dbNotFound: 'Error: no se encontró la base de datos.',
      sharingUnavailable: 'Error: compartir archivos no está disponible en este dispositivo.',
      exportErrorPrefix: 'Error al exportar: ',
      importErrorPrefix: 'Error al importar: ',
      categories: 'Categorías',
      categoriesDesc: 'Gestioná las categorías de tus transacciones.',
      addCategory: 'Nueva categoría',
      categoryName: 'Nombre de la categoría',
      colorLabel: 'Color',
      accounts: 'Cuentas',
      accountsDesc: 'Gestioná tus cuentas y billeteras.',
      addAccount: 'Nueva cuenta',
      accountName: 'Nombre de la cuenta',
      currencyLabel: 'Moneda (ej: USD, ARS)',
    },
    drive: {
      title: 'Google Drive',
      desc: 'Guardá y restaurá tu base de datos en la nube.',
      upload: '☁ Guardar en Drive',
      restore: '☁ Restaurar desde Drive',
      uploading: 'Subiendo...',
      restoring: 'Restaurando...',
      uploadSuccess: 'Base de datos guardada en Google Drive ✓',
      restoreSuccess: 'Restaurada desde Drive. Reiniciá la app.',
      notFound: 'No se encontró backup en Google Drive.',
      tokenExpired: 'Sesión expirada. Cerrá sesión y volvé a iniciar.',
      signInRequired: 'Iniciá sesión con Google para usar Drive.',
      errorPrefix: 'Error: ',
    },
    loans: {
      tab: 'Préstamos',
      title: 'Préstamos',
      empty: 'Sin personas registradas',
      emptyLoans: 'Sin préstamos para esta persona',
      addPerson: 'Nueva persona',
      addLoan: 'Nuevo préstamo',
      personName: 'Nombre',
      personNamePlaceholder: 'Ej: Juan Pérez',
      description: 'Descripción',
      descriptionPlaceholder: 'Ej: Para el almuerzo',
      amount: 'Monto',
      date: 'Fecha',
      pending: 'Pendiente',
      paid: 'Pagado',
      markPaid: 'Marcar pagado',
      markPending: 'Marcar pendiente',
      totalPending: 'Total pendiente',
      deleteConfirm: '¿Eliminar este préstamo?',
      deletePersonConfirm: '¿Eliminar esta persona y todos sus préstamos?',
      nameRequired: 'El nombre es obligatorio',
      amountRequired: 'El monto debe ser mayor a 0',
      dateRequired: 'La fecha es obligatoria',
      descriptionRequired: 'La descripción es obligatoria',
      totalLoaned: 'Total prestado',
      addPayment: 'Registrar abono',
      payment: 'Abono',
      payments: 'Abonos',
      noPayments: 'Sin abonos',
      outstanding: 'Saldo',
      totalPaid: 'Abonado',
      paymentAmount: 'Monto del abono',
      interestRate: 'Tasa de interés (%)',
      interestRatePlaceholder: '0',
      months: 'Plazo (meses)',
      monthsPlaceholder: '1',
      interestType: 'Tipo de interés',
      simple: 'Simple',
      compound: 'Compuesto',
      estimatedTotal: 'Total estimado',
      interest: 'Interés',
    },
  },

  en: {
    tabs: {
      expenses: 'Expenses',
      stats: 'Summary',
      loans: 'Loans',
      config: 'Settings',
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: '+ Add',
      back: 'Back',
      error: 'Error',
      required: '*',
      income: 'Income',
      expense: 'Expense',
    },
    expenses: {
      search: 'Search',
      empty: 'No transactions',
      newExpense: 'New Transaction',
      editExpense: 'Edit Transaction',
      description: 'Description',
      descriptionPlaceholder: 'E.g. Lunch, Salary...',
      amount: 'Amount',
      amountPlaceholder: '0.00',
      date: 'Date',
      datePlaceholder: 'DD/MM/YYYY',
      type: 'Type',
      category: 'Category',
      account: 'Account',
      notes: 'Notes',
      notesPlaceholder: 'Additional notes...',
      descriptionRequired: 'Description is required',
      amountRequired: 'Amount must be greater than 0',
      dateRequired: 'Date is required',
      createError: 'Error creating transaction',
      deleteConfirm: 'Delete this transaction?',
      noCategory: 'No category',
      noAccount: 'No account',
    },
    summary: {
      income: 'Income',
      expense: 'Expenses',
      balance: 'Balance',
    },
    stats: {
      title: 'Summary',
      annual: 'Annual summary',
      monthly: 'By month',
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      income: 'Income',
      expense: 'Expenses',
      balance: 'Balance',
      noData: 'No data for this year',
    },
    config: {
      title: 'Settings',
      database: 'Database',
      databaseDesc: 'Export a backup or import an existing database.',
      exportBtn: '⬆ Export',
      importBtn: '⬇ Import',
      language: 'Language',
      languageDesc: 'Select the app language.',
      exportSuccess: 'Database exported successfully.',
      importSuccess: 'Database imported. Restart the app to see changes.',
      importTitle: 'Import database',
      importConfirm: 'This will replace all current data. Do you want to continue?',
      importSuccessTitle: 'Import successful',
      importSuccessMsg: 'Restart the application for changes to take effect.',
      importContinue: 'Continue',
      dbNotFound: 'Error: database not found.',
      sharingUnavailable: 'Error: file sharing is not available on this device.',
      exportErrorPrefix: 'Export error: ',
      importErrorPrefix: 'Import error: ',
      categories: 'Categories',
      categoriesDesc: 'Manage your transaction categories.',
      addCategory: 'New category',
      categoryName: 'Category name',
      colorLabel: 'Color',
      accounts: 'Accounts',
      accountsDesc: 'Manage your accounts and wallets.',
      addAccount: 'New account',
      accountName: 'Account name',
      currencyLabel: 'Currency (e.g. USD, EUR)',
    },
    drive: {
      title: 'Google Drive',
      desc: 'Save and restore your database to the cloud.',
      upload: '☁ Save to Drive',
      restore: '☁ Restore from Drive',
      uploading: 'Uploading...',
      restoring: 'Restoring...',
      uploadSuccess: 'Database saved to Google Drive ✓',
      restoreSuccess: 'Restored from Drive. Restart the app.',
      notFound: 'No backup found in Google Drive.',
      tokenExpired: 'Session expired. Sign out and sign in again.',
      signInRequired: 'Sign in with Google to use Drive.',
      errorPrefix: 'Error: ',
    },
    loans: {
      tab: 'Loans',
      title: 'Loans',
      empty: 'No people registered',
      emptyLoans: 'No loans for this person',
      addPerson: 'New person',
      addLoan: 'New loan',
      personName: 'Name',
      personNamePlaceholder: 'E.g. John Doe',
      description: 'Description',
      descriptionPlaceholder: 'E.g. For lunch',
      amount: 'Amount',
      date: 'Date',
      pending: 'Pending',
      paid: 'Paid',
      markPaid: 'Mark paid',
      markPending: 'Mark pending',
      totalPending: 'Total pending',
      deleteConfirm: 'Delete this loan?',
      deletePersonConfirm: 'Delete this person and all their loans?',
      nameRequired: 'Name is required',
      amountRequired: 'Amount must be greater than 0',
      dateRequired: 'Date is required',
      descriptionRequired: 'Description is required',
      totalLoaned: 'Total loaned',
      addPayment: 'Register payment',
      payment: 'Payment',
      payments: 'Payments',
      noPayments: 'No payments',
      outstanding: 'Balance',
      totalPaid: 'Paid',
      paymentAmount: 'Payment amount',
      interestRate: 'Interest rate (%)',
      interestRatePlaceholder: '0',
      months: 'Term (months)',
      monthsPlaceholder: '1',
      interestType: 'Interest type',
      simple: 'Simple',
      compound: 'Compound',
      estimatedTotal: 'Estimated total',
      interest: 'Interest',
    },
  },
} as const;

export type T = typeof translations.es;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'es',
  setLang: () => {},
  t: translations.es,
});

function detectDeviceLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.startsWith('es') ? 'es' : 'en';
  } catch {
    return 'es';
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es');

  useEffect(() => {
    storage.getItem(LANG_KEY).then(stored => {
      if (stored === 'es' || stored === 'en') {
        setLangState(stored);
      } else {
        setLangState(detectDeviceLang());
      }
    });
  }, []);

  const setLang = async (newLang: Lang) => {
    setLangState(newLang);
    await storage.setItem(LANG_KEY, newLang);
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t: translations[lang] as T }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
