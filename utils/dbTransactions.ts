/**
 * Transaction support shared by the Electron and native DB adapters.
 *
 * Both adapters run statements on a single shared connection, and repository
 * code awaits between statements. Without coordination, a write from elsewhere
 * in the app can land inside an open BEGIN…COMMIT and be undone by its ROLLBACK.
 * While a transaction is open, every regular `db` call waits for it to finish;
 * statements inside the transaction go through the `tx` handle instead.
 */

export interface DbAdapter {
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  runAsync(sql: string, ...params: unknown[]): Promise<void>;
  execAsync(sql: string): Promise<void>;
}

export interface TransactionalDb extends DbAdapter {
  /**
   * Runs `work` atomically. Use only `tx` inside it: calling `db` (or another
   * `withTransactionAsync`) from within `work` waits for this transaction and deadlocks.
   */
  withTransactionAsync<T>(work: (tx: DbAdapter) => Promise<T>): Promise<T>;
}

export function createTransactionalDb(raw: DbAdapter) {
  // Settles when the currently open transaction (if any) finishes.
  let openTransaction: Promise<void> = Promise.resolve();

  /**
   * Runs `op` once no transaction is open. `op` is invoked synchronously right
   * after the final check, so a transaction can't start in between.
   */
  async function outsideTransaction<T>(op: () => Promise<T>): Promise<T> {
    let observed: Promise<void>;
    do {
      observed = openTransaction;
      await observed;
    } while (observed !== openTransaction);
    return op();
  }

  /**
   * Runs `op` with exclusive access to the connection: regular calls wait until
   * it finishes. Used for transactions and for whole-file operations (import,
   * export, merge) that must not interleave with other statements.
   */
  async function exclusively<T>(op: () => Promise<T>): Promise<T> {
    let release!: () => void;
    await outsideTransaction(async () => {
      openTransaction = new Promise<void>(resolve => { release = resolve; });
    });
    try {
      return await op();
    } finally {
      release();
    }
  }

  function withTransactionAsync<T>(work: (tx: DbAdapter) => Promise<T>): Promise<T> {
    return exclusively(async () => {
      await raw.execAsync('BEGIN');
      try {
        const result = await work(raw);
        await raw.execAsync('COMMIT');
        return result;
      } catch (e) {
        await raw.execAsync('ROLLBACK').catch(() => {});
        throw e;
      }
    });
  }

  const db: TransactionalDb = {
    getAllAsync: <T>(sql: string, ...params: unknown[]) =>
      outsideTransaction(() => raw.getAllAsync<T>(sql, ...params)),
    getFirstAsync: <T>(sql: string, ...params: unknown[]) =>
      outsideTransaction(() => raw.getFirstAsync<T>(sql, ...params)),
    runAsync: (sql: string, ...params: unknown[]) =>
      outsideTransaction(() => raw.runAsync(sql, ...params)),
    execAsync: (sql: string) =>
      outsideTransaction(() => raw.execAsync(sql)),
    withTransactionAsync,
  };

  return { db, exclusively };
}
