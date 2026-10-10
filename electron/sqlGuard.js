// The renderer builds its own SQL and sends it over IPC, so the main process
// only accepts plain data statements. Multi-statement strings are rejected by
// better-sqlite3's prepare(), which closes the "SELECT 1; DROP TABLE ..." bypass.

const WRITE_KEYWORDS = new Set(['INSERT', 'UPDATE', 'DELETE', 'REPLACE']);
const READ_KEYWORDS = new Set(['SELECT', 'WITH']);
const DATA_KEYWORDS = new Set([...READ_KEYWORDS, ...WRITE_KEYWORDS]);
const TRANSACTION_CONTROL = /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;?\s*$/i;
const LEADING_TRIVIA = /^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/;

function leadingKeyword(sql) {
  // Strip whitespace and comments so "/* */ ATTACH ..." can't hide the verb.
  const match = /^[A-Za-z]+/.exec(sql.replace(LEADING_TRIVIA, ''));
  return match ? match[0].toUpperCase() : '';
}

function assertString(sql) {
  if (typeof sql !== 'string') throw new Error('SQL must be a string');
}

function assertKeywordIn(sql, allowed) {
  assertString(sql);
  const keyword = leadingKeyword(sql);
  if (!allowed.has(keyword)) {
    throw new Error(`SQL statement not allowed: ${keyword || '(empty)'}`);
  }
}

const assertReadStatement = (sql) => assertKeywordIn(sql, READ_KEYWORDS);
const assertDataStatement = (sql) => assertKeywordIn(sql, DATA_KEYWORDS);

function assertTransactionControl(sql) {
  assertString(sql);
  if (!TRANSACTION_CONTROL.test(sql)) {
    throw new Error('Only BEGIN, COMMIT or ROLLBACK can be executed directly');
  }
}

module.exports = { assertReadStatement, assertDataStatement, assertTransactionControl };
