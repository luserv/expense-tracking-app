// The renderer builds its own SQL and sends it over IPC, so the main process
// only accepts plain data statements. Multi-statement strings are rejected by
// better-sqlite3's prepare(), which closes the "SELECT 1; DROP TABLE ..." bypass.

const WRITE_KEYWORDS = new Set(['INSERT', 'UPDATE', 'DELETE', 'REPLACE']);
const READ_KEYWORDS = new Set(['SELECT', 'WITH']);
const DATA_KEYWORDS = new Set([...READ_KEYWORDS, ...WRITE_KEYWORDS]);
const TRANSACTION_CONTROL = /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;?\s*$/i;
const LEADING_TRIVIA = /^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/;

function leadingKeyword(sql: string): string {
  // Strip whitespace and comments so "/* */ ATTACH ..." can't hide the verb.
  const match = /^[A-Za-z]+/.exec(sql.replace(LEADING_TRIVIA, ''));
  return match ? match[0].toUpperCase() : '';
}

function assertString(sql: unknown): asserts sql is string {
  if (typeof sql !== 'string') throw new Error('SQL must be a string');
}

function assertKeywordIn(sql: unknown, allowed: ReadonlySet<string>): asserts sql is string {
  assertString(sql);
  const keyword = leadingKeyword(sql);
  if (!allowed.has(keyword)) {
    throw new Error(`SQL statement not allowed: ${keyword || '(empty)'}`);
  }
}

export const assertReadStatement: (sql: unknown) => asserts sql is string =
  (sql) => assertKeywordIn(sql, READ_KEYWORDS);
export const assertDataStatement: (sql: unknown) => asserts sql is string =
  (sql) => assertKeywordIn(sql, DATA_KEYWORDS);

export function assertTransactionControl(sql: unknown): asserts sql is string {
  assertString(sql);
  if (!TRANSACTION_CONTROL.test(sql)) {
    throw new Error('Only BEGIN, COMMIT or ROLLBACK can be executed directly');
  }
}
