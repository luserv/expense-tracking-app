/**
 * Adaptador SQLite para Electron / Web.
 * Las operaciones de DB van al proceso principal de Electron via IPC
 * (expuesto por electron/preload.js a través de contextBridge).
 */

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

export const db = {
  getAllAsync: <T>(sql: string, ...params: unknown[]): Promise<T[]> =>
    window.electronDB.getAllAsync(sql, params) as Promise<T[]>,

  getFirstAsync: <T>(sql: string, ...params: unknown[]): Promise<T | null> =>
    window.electronDB.getFirstAsync(sql, params) as Promise<T | null>,

  runAsync: (sql: string, ...params: unknown[]): Promise<void> =>
    window.electronDB.runAsync(sql, params),

  execAsync: (sql: string): Promise<void> =>
    window.electronDB.execAsync(sql),
};

/** Lee la DB local como base64 (el proceso principal hace checkpoint del WAL). */
export async function exportDatabaseToBase64(): Promise<string> {
  if (!window.electronDrive) throw new Error('Drive bridge no disponible');
  return window.electronDrive.readDBAsBase64();
}

/** Reemplaza la DB local con el base64 dado. El main process cierra y reabre la conexión. */
export async function importDatabaseFromBase64(base64: string): Promise<void> {
  if (!window.electronDrive) throw new Error('Drive bridge no disponible');
  const r = await window.electronDrive.writeDBFromBase64(base64);
  if (r?.error) throw new Error(r.error);
}

/** Fusiona la DB remota (base64) en la local fila por fila (LWW por updated_at). */
export async function mergeDatabaseFromBase64(base64: string): Promise<void> {
  if (!window.electronDrive) throw new Error('Drive bridge no disponible');
  const r = await window.electronDrive.mergeDBFromBase64(base64);
  if (r?.error) throw new Error(r.error);
}

/** Firma del contenido para decidir si propagar cambios. */
export async function getDatabaseSignature(): Promise<string> {
  if (!window.electronDrive) throw new Error('Drive bridge no disponible');
  return window.electronDrive.dbSignature();
}
