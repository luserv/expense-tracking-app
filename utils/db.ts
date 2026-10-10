/**
 * Adaptador SQLite para Electron / Web.
 * Las operaciones de DB van al proceso principal de Electron via IPC
 * (expuesto por electron/preload.js a través de contextBridge).
 */
import { createTransactionalDb, type DbAdapter } from './dbTransactions';

declare global {
  interface Window {
    electronDB: {
      getAllAsync: (sql: string, params: unknown[]) => Promise<unknown[]>;
      getFirstAsync: (sql: string, params: unknown[]) => Promise<unknown | null>;
      runAsync: (sql: string, params: unknown[]) => Promise<void>;
      execAsync: (sql: string) => Promise<void>;
    };
    electronDrive?: {
      readDBAsBase64: () => Promise<string>;
      writeDBFromBase64: (base64: string) => Promise<{ success?: boolean; error?: string }>;
      mergeDBFromBase64: (base64: string) => Promise<{ success?: boolean; error?: string }>;
      dbSignature: () => Promise<string>;
    };
  }
}

const electronAdapter: DbAdapter = {
  getAllAsync: <T>(sql: string, ...params: unknown[]): Promise<T[]> =>
    window.electronDB.getAllAsync(sql, params) as Promise<T[]>,

  getFirstAsync: <T>(sql: string, ...params: unknown[]): Promise<T | null> =>
    window.electronDB.getFirstAsync(sql, params) as Promise<T | null>,

  runAsync: (sql: string, ...params: unknown[]): Promise<void> =>
    window.electronDB.runAsync(sql, params),

  execAsync: (sql: string): Promise<void> =>
    window.electronDB.execAsync(sql),
};

const { db, exclusively } = createTransactionalDb(electronAdapter);
export { db };

/** Lee la DB local como base64 (el proceso principal hace checkpoint del WAL). */
export function exportDatabaseToBase64(): Promise<string> {
  return exclusively(async () => {
    if (!window.electronDrive) throw new Error('Drive bridge no disponible');
    return window.electronDrive.readDBAsBase64();
  });
}

/** Reemplaza la DB local con el base64 dado. El main process cierra y reabre la conexión. */
export function importDatabaseFromBase64(base64: string): Promise<void> {
  return exclusively(async () => {
    if (!window.electronDrive) throw new Error('Drive bridge no disponible');
    const r = await window.electronDrive.writeDBFromBase64(base64);
    if (r?.error) throw new Error(r.error);
  });
}

/** Fusiona la DB remota (base64) en la local fila por fila (LWW por updated_at). */
export function mergeDatabaseFromBase64(base64: string): Promise<void> {
  return exclusively(async () => {
    if (!window.electronDrive) throw new Error('Drive bridge no disponible');
    const r = await window.electronDrive.mergeDBFromBase64(base64);
    if (r?.error) throw new Error(r.error);
  });
}

/** Firma del contenido para decidir si propagar cambios. */
export function getDatabaseSignature(): Promise<string> {
  return exclusively(async () => {
    if (!window.electronDrive) throw new Error('Drive bridge no disponible');
    return window.electronDrive.dbSignature();
  });
}
