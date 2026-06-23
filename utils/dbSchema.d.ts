/** Tipos para el esquema compartido (utils/dbSchema.js, CommonJS). */
export const CREATE_TABLES: string[];
export const CREATE_INDEXES: string[];
export const MIGRATIONS: string[];
export const SEED: string[];
export const SYNC_TABLES: { table: string; pk: string[] }[];
export function buildMergeStatement(table: string, pk: string[], cols: string[]): string;
