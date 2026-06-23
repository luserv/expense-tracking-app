/**
 * Sincronización entre dispositivos (MVP: archivo .db completo, "último que guarda gana").
 *
 * Flujo (sincronización por registro):
 *  - pushNow: sube la DB local al archivo canónico de Drive, marcada con este deviceId,
 *    y guarda la firma de contenido subida.
 *  - pullIfNeeded: si el archivo remoto lo escribió OTRO dispositivo y es más nuevo que
 *    nuestra marca, lo baja y lo FUSIONA fila por fila (gana la versión más nueva de
 *    cada registro, vía updated_at). Si la unión local difiere de lo último que subimos,
 *    la propagamos. La firma evita el ping-pong infinito entre dispositivos.
 *
 * Sin pérdida de datos salvo edición concurrente del MISMO registro (ahí gana el más nuevo).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { exportDatabaseToBase64, getDatabaseSignature, mergeDatabaseFromBase64 } from './db';
import { downloadSyncFile, getSyncMeta, uploadSyncDB } from './driveSync';

const DEVICE_ID_KEY = 'sync_device_id';
const WATERMARK_KEY = 'sync_remote_modified';
const AUTO_SYNC_KEY = 'sync_auto_enabled';
const LAST_SYNC_KEY = 'sync_last_at';
const SIG_KEY = 'sync_last_pushed_sig';

export type ClientKind = 'android' | 'electron' | 'web';

export function platformTag(): ClientKind {
  if (Platform.OS === 'android') return 'android';
  if (typeof window !== 'undefined' && (window as any).electronFS) return 'electron';
  return 'web';
}

let _deviceId: string | null = null;

/** Identificador estable de esta instalación. Se genera una vez y se persiste. */
export async function getDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId;
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${platformTag()}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  _deviceId = id;
  return id;
}

export async function isAutoSyncEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(AUTO_SYNC_KEY)) === 'true';
}

export async function setAutoSyncEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_SYNC_KEY, enabled ? 'true' : 'false');
}

export async function getLastSyncAt(): Promise<number | null> {
  const v = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return v ? Number(v) : null;
}

export interface PullResult {
  changed: boolean;
  reason?: 'no-remote' | 'own' | 'up-to-date';
}

/** Baja y FUSIONA la DB remota solo si la escribió otro dispositivo y es más nueva. */
export async function pullIfNeeded(token: string): Promise<PullResult> {
  const meta = await getSyncMeta(token);
  if (!meta) return { changed: false, reason: 'no-remote' };

  const myId = await getDeviceId();
  if (meta.deviceId === myId) return { changed: false, reason: 'own' };

  const watermark = await AsyncStorage.getItem(WATERMARK_KEY);
  if (watermark && meta.modifiedTime <= watermark) return { changed: false, reason: 'up-to-date' };

  const base64 = await downloadSyncFile(token, meta.fileId);
  await mergeDatabaseFromBase64(base64);
  await AsyncStorage.setItem(WATERMARK_KEY, meta.modifiedTime);
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));

  // Si la unión local difiere de lo último que subimos, propagamos (con tope anti-bucle).
  const sig = await getDatabaseSignature();
  const lastSig = await AsyncStorage.getItem(SIG_KEY);
  if (sig !== lastSig) {
    await pushNow(token);
  }
  return { changed: true };
}

/** Sube la DB local al archivo de sync de Drive y registra la firma subida. */
export async function pushNow(token: string): Promise<void> {
  const base64 = await exportDatabaseToBase64();
  const myId = await getDeviceId();
  const meta = await uploadSyncDB(token, base64, myId);
  const sig = await getDatabaseSignature();
  await AsyncStorage.multiSet([
    [WATERMARK_KEY, meta.modifiedTime],
    [LAST_SYNC_KEY, String(Date.now())],
    [SIG_KEY, sig],
  ]);
}

/**
 * Sincronización manual: baja+fusiona cambios remotos; si no había nada nuevo,
 * sube la versión local. Retorna si se fusionaron cambios remotos.
 */
export async function syncNow(token: string): Promise<PullResult> {
  const pulled = await pullIfNeeded(token);
  if (!pulled.changed) {
    await pushNow(token);
  }
  return pulled;
}

// ── Push con debounce tras escrituras ──────────────────────────────────────────

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Programa un push diferido (se reinicia con cada escritura para agrupar cambios). */
export function schedulePush(getToken: () => string | null, delay = 4000): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    const token = getToken();
    if (!token) return;
    if (!(await isAutoSyncEnabled())) return;
    try {
      await pushNow(token);
    } catch (e) {
      console.warn('[sync] push falló:', e);
    }
  }, delay);
}
