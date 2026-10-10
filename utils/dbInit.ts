/**
 * Inicialización del esquema de base de datos — Control de Gastos.
 * Compatible con expo-sqlite (native) y el adaptador IPC de Electron.
 *
 * El esquema vive en una FUENTE ÚNICA (utils/dbSchema.ts) que también
 * consume electron/main.ts, para no duplicar/derivar definiciones entre runtimes.
 */
import { CREATE_INDEXES, CREATE_TABLES, MIGRATIONS, SEED } from './dbSchema';

interface MinimalDB {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<void>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
}

export async function initializeDatabase(db: MinimalDB) {
  for (const sql of CREATE_TABLES) await db.execAsync(sql);
  // Migraciones ANTES que los índices: agregan columnas (ej. transfer_pair_id,
  // updated_at) que los índices referencian. Fallan silenciosamente si ya existen.
  for (const sql of MIGRATIONS) { try { await db.runAsync(sql); } catch {} }
  for (const sql of CREATE_INDEXES) { try { await db.execAsync(sql); } catch {} }
  for (const sql of SEED) await db.execAsync(sql);
}
