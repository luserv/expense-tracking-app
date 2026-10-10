/**
 * Generador de IDs con prefijo. Usa crypto.randomUUID cuando está disponible
 * (Electron/Web y RN moderno) y cae a un aleatorio largo si no.
 *
 * El prefijo (ej. 'exp', 'cat') mantiene legibilidad; el sufijo UUID hace
 * despreciable la colisión incluso al mergear datos entre dispositivos.
 */
function uuid(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback: use crypto.getRandomValues if available, else Math.random.
  if (c?.getRandomValues) {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);
    return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  }
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 12)
  );
}

export function genId(prefix: string): string {
  return `${prefix}_${uuid()}`;
}
