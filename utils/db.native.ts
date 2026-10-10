/**
 * Adaptador SQLite para Android / iOS (Metro resuelve .native.ts automáticamente).
 * Usa la API síncrona de expo-sqlite v16 envuelta en Promises para mantener
 * la misma interfaz que el adaptador de Electron.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from './dbInit';
import { buildMergeStatement, SYNC_TABLES } from './dbSchema';
import { createTransactionalDb, type DbAdapter } from './dbTransactions';

const DB_NAME = 'gastos.db';
const DB_PATH = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;

// `let` (no `const`): al importar una DB desde otro dispositivo cerramos y
// reabrimos la conexión, reasignando _db. Los métodos exportados leen el
// valor actual de la variable de módulo, así que ven la nueva conexión.
let _db = SQLite.openDatabaseSync(DB_NAME);

function runInit(): Promise<void> {
  return initializeDatabase({
    execAsync: (sql) => { _db.execSync(sql); return Promise.resolve(); },
    runAsync: (sql, ...p) => { _db.runSync(sql, p as any); return Promise.resolve(); },
    getAllAsync: () => Promise.resolve([]),
    getFirstAsync: () => Promise.resolve(null),
  });
}

// Inicialización al cargar el módulo
void runInit();

const nativeAdapter: DbAdapter = {
  getAllAsync: <T>(sql: string, ...params: unknown[]): Promise<T[]> =>
    Promise.resolve(_db.getAllSync<T>(sql, params as any)),

  getFirstAsync: <T>(sql: string, ...params: unknown[]): Promise<T | null> =>
    Promise.resolve(_db.getFirstSync<T>(sql, params as any) ?? null),

  runAsync: (sql: string, ...params: unknown[]): Promise<void> => {
    _db.runSync(sql, params as any);
    return Promise.resolve();
  },

  execAsync: (sql: string): Promise<void> => {
    _db.execSync(sql);
    return Promise.resolve();
  },
};

const { db, exclusively } = createTransactionalDb(nativeAdapter);
export { db };

/** Lee la DB local como base64. Hace checkpoint del WAL para incluir cambios pendientes. */
export function exportDatabaseToBase64(): Promise<string> {
  return exclusively(async () => {
    try { _db.execSync('PRAGMA wal_checkpoint(FULL)'); } catch {}
    return FileSystem.readAsStringAsync(DB_PATH, { encoding: FileSystem.EncodingType.Base64 });
  });
}

/** Reemplaza la DB local con el base64 dado y reabre la conexión (sin reiniciar la app). */
export function importDatabaseFromBase64(base64: string): Promise<void> {
  return exclusively(async () => {
    try { _db.closeSync(); } catch {}

    const dir = `${FileSystem.documentDirectory}SQLite`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    // Eliminar WAL/SHM: si quedan, SQLite los aplicaría sobre el archivo nuevo y lo corrompería.
    for (const suffix of ['-wal', '-shm']) {
      try { await FileSystem.deleteAsync(DB_PATH + suffix, { idempotent: true }); } catch {}
    }

    await FileSystem.writeAsStringAsync(DB_PATH, base64, { encoding: FileSystem.EncodingType.Base64 });

    _db = SQLite.openDatabaseSync(DB_NAME);
    await runInit();
  });
}

/**
 * Fusiona la DB remota (base64) en la local, fila por fila: gana la versión más
 * nueva de cada registro (LWW por `updated_at`). No reemplaza el archivo.
 */
export function mergeDatabaseFromBase64(base64: string): Promise<void> {
  return exclusively(async () => {
    const tmpUri = `${FileSystem.documentDirectory}SQLite/_sync_remote.db`;
    await FileSystem.writeAsStringAsync(tmpUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    const tmpPath = tmpUri.replace('file://', '');

    try {
      _db.execSync(`ATTACH DATABASE '${tmpPath.replace(/'/g, "''")}' AS remote`);
      _db.execSync('BEGIN');
      try {
        for (const { table, pk } of SYNC_TABLES) {
          const localCols = _db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`).map(r => r.name);
          const remoteCols = _db.getAllSync<{ name: string }>(`PRAGMA remote.table_info(${table})`).map(r => r.name);
          const cols = localCols.filter(c => remoteCols.includes(c));
          if (!cols.includes('updated_at')) continue;
          _db.execSync(buildMergeStatement(table, pk, cols));
        }
        _db.execSync('COMMIT');
      } catch (e) {
        try { _db.execSync('ROLLBACK'); } catch {}
        throw e;
      }
    } finally {
      try { _db.execSync('DETACH DATABASE remote'); } catch {}
      try { await FileSystem.deleteAsync(tmpUri, { idempotent: true }); } catch {}
    }
  });
}

/** Firma del contenido (filas + suma/máx de updated_at) para decidir si propagar cambios. */
export function getDatabaseSignature(): Promise<string> {
  return exclusively(async () => {
    let rows = 0, sum = 0, max = 0;
    for (const { table } of SYNC_TABLES) {
      const r = _db.getFirstSync<{ c: number; s: number; m: number }>(
        `SELECT COUNT(*) c, COALESCE(SUM(updated_at),0) s, COALESCE(MAX(updated_at),0) m FROM ${table}`
      );
      if (r) { rows += r.c; sum += r.s; max = Math.max(max, r.m); }
    }
    return `${rows}:${sum}:${max}`;
  });
}
