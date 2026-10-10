/**
 * Sincronización entre dispositivos (MVP: archivo .db completo, "último que guarda gana").
 *
 * Flujo (sincronización por registro):
 *  - Toda subida fusiona antes lo remoto (mergeThenUpload), así nunca se pisa el
 *    trabajo de otro dispositivo que todavía no vimos. Las operaciones se serializan.
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

// ── Serialization ──────────────────────────────────────────────────────────────

// Sync steps read and write the same remote file and the same local DB, so they
// must never overlap (e.g. a scheduled push racing a foreground pull).
let queue: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

// ── Steps ───────────────────────────────────────────────────────────────────────

/** Downloads and merges the remote DB only if another device wrote it after our watermark. */
async function mergeRemoteIfNewer(token: string): Promise<PullResult> {
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
  return { changed: true };
}

/** Uploads the local DB to the Drive sync file and records the uploaded signature. */
async function upload(token: string): Promise<void> {
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

/** Merge remote changes first, then upload: never overwrite another device's unseen work. */
async function mergeThenUpload(token: string): Promise<PullResult> {
  const pulled = await mergeRemoteIfNewer(token);
  await upload(token);
  return pulled;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Background pull: merges remote changes and propagates the union only if it
 * differs from what we last uploaded. The signature check prevents ping-pong
 * between devices.
 */
export function pullIfNeeded(token: string): Promise<PullResult> {
  return serialized(async () => {
    const pulled = await mergeRemoteIfNewer(token);
    if (pulled.changed) {
      const sig = await getDatabaseSignature();
      const lastSig = await AsyncStorage.getItem(SIG_KEY);
      if (sig !== lastSig) await upload(token);
    }
    return pulled;
  });
}

/**
 * Full sync (manual button, enabling sync, after local writes): merge remote
 * changes, then always upload so local changes propagate.
 * Returns whether remote changes were merged.
 */
export function syncNow(token: string): Promise<PullResult> {
  return serialized(() => mergeThenUpload(token));
}

// ── Debounced sync after writes ───────────────────────────────────────────────

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedules a deferred sync, restarted by every write so changes are batched.
 * It merges before uploading; onRemoteMerged runs when remote changes arrived.
 */
export function schedulePush(
  getToken: () => string | null,
  onRemoteMerged?: () => void,
  delay = 4000,
): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    const token = getToken();
    if (!token) return;
    if (!(await isAutoSyncEnabled())) return;
    try {
      const { changed } = await syncNow(token);
      if (changed) onRemoteMerged?.();
    } catch (e) {
      console.warn('[sync] push falló:', e);
    }
  }, delay);
}
