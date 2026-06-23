/**
 * Google Drive API utilities — backup / restore de la base de datos.
 * Estructura: chiro/db/backup-YYYY-MM-DDTHH-MM-SS.db
 * Usa drive.file scope: solo accede a archivos creados por esta app.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_PATH = ['chiro', 'db'];
/** Archivo único y sobrescribible que usamos para la sincronización entre dispositivos. */
const SYNC_FILE = 'chiro-sync.db';

async function driveJSON(url: string, token: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers as object ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err?.error?.code === 401) throw new Error('TOKEN_EXPIRED');
    throw new Error(`Drive error: ${res.status}`);
  }
  return res.json();
}

async function findFolder(token: string, name: string, parentId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  const data = await driveJSON(`${DRIVE_API}?q=${q}&fields=files(id)`, token);
  return data.files?.[0]?.id ?? null;
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const data = await driveJSON(DRIVE_API, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  return data.id;
}

async function getOrCreateFolderPath(token: string): Promise<string> {
  let parentId = 'root';
  for (const name of FOLDER_PATH) {
    const existing = await findFolder(token, name, parentId);
    parentId = existing ?? await createFolder(token, name, parentId);
  }
  return parentId;
}

function timestampFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `backup-${date}T${time}.db`;
}

/** Sube la DB (en base64) a chiro/db/backup-fecha-hora.db en Google Drive. */
export async function uploadDB(token: string, base64: string): Promise<void> {
  let binary: Uint8Array;
  try {
    binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  } catch {
    throw new Error('Error al leer la base de datos local');
  }

  const folderId = await getOrCreateFolderPath(token);
  const fileName = timestampFilename();
  const boundary = 'chiro_boundary';
  const meta = JSON.stringify({
    name: fileName,
    mimeType: 'application/x-sqlite3',
    parents: [folderId],
  });

  const encoder = new TextEncoder();
  const part1 = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`
  );
  const part2 = encoder.encode(
    `--${boundary}\r\nContent-Type: application/x-sqlite3\r\n\r\n`
  );
  const part3 = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(part1.length + part2.length + binary.length + part3.length);
  let offset = 0;
  body.set(part1, offset); offset += part1.length;
  body.set(part2, offset); offset += part2.length;
  body.set(binary, offset); offset += binary.length;
  body.set(part3, offset);

  await driveJSON(`${DRIVE_UPLOAD}?uploadType=multipart`, token, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: body.buffer,
  });
}

/** Descarga el backup más reciente desde chiro/db/ en Google Drive. Retorna base64. */
export async function downloadDB(token: string): Promise<string> {
  const folderId = await getOrCreateFolderPath(token);

  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const data = await driveJSON(
    `${DRIVE_API}?q=${q}&orderBy=createdTime desc&fields=files(id,name)&pageSize=1`,
    token
  );
  if (!data.files?.length) throw new Error('NO_BACKUP');

  const fileId = data.files[0].id;
  const res = await fetch(`${DRIVE_API}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err?.error?.code === 401) throw new Error('TOKEN_EXPIRED');
    throw new Error(`Error al descargar: ${res.status}`);
  }

  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ── Sincronización entre dispositivos (archivo canónico chiro-sync.db) ─────────

export interface SyncMeta {
  fileId: string;
  /** RFC3339 (UTC). Comparable lexicográficamente para saber cuál es más nuevo. */
  modifiedTime: string;
  /** deviceId que escribió esta versión (en appProperties). Sirve para no reimportar lo propio. */
  deviceId: string | null;
}

function base64ToBytes(base64: string): Uint8Array {
  try {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  } catch {
    throw new Error('Error al leer la base de datos local');
  }
}

/** Construye el cuerpo multipart/related (metadata JSON + binario sqlite). */
function multipartBody(meta: object, binary: Uint8Array, boundary: string): ArrayBuffer {
  const encoder = new TextEncoder();
  const part1 = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`
  );
  const part2 = encoder.encode(
    `--${boundary}\r\nContent-Type: application/x-sqlite3\r\n\r\n`
  );
  const part3 = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(part1.length + part2.length + binary.length + part3.length);
  let offset = 0;
  body.set(part1, offset); offset += part1.length;
  body.set(part2, offset); offset += part2.length;
  body.set(binary, offset); offset += binary.length;
  body.set(part3, offset);
  return body.buffer;
}

/** Devuelve la metadata del archivo de sync, o null si todavía no existe. */
export async function getSyncMeta(token: string): Promise<SyncMeta | null> {
  const folderId = await getOrCreateFolderPath(token);
  const q = encodeURIComponent(
    `name='${SYNC_FILE}' and '${folderId}' in parents and trashed=false`
  );
  const data = await driveJSON(
    `${DRIVE_API}?q=${q}&fields=files(id,modifiedTime,appProperties)&pageSize=1`,
    token
  );
  const f = data.files?.[0];
  if (!f) return null;
  return { fileId: f.id, modifiedTime: f.modifiedTime, deviceId: f.appProperties?.deviceId ?? null };
}

/**
 * Sube/sobrescribe el archivo de sync con la DB local (base64) y marca el deviceId
 * que la escribió. Retorna la metadata resultante (con el nuevo modifiedTime).
 */
export async function uploadSyncDB(token: string, base64: string, deviceId: string): Promise<SyncMeta> {
  const binary = base64ToBytes(base64);
  const existing = await getSyncMeta(token);
  const boundary = 'chiro_sync_boundary';

  let url: string;
  let method: 'POST' | 'PATCH';
  let meta: object;

  if (existing) {
    // Actualizar el archivo existente (no se pueden cambiar los parents en PATCH).
    url = `${DRIVE_UPLOAD}/${existing.fileId}?uploadType=multipart&fields=id,modifiedTime,appProperties`;
    method = 'PATCH';
    meta = { name: SYNC_FILE, mimeType: 'application/x-sqlite3', appProperties: { deviceId } };
  } else {
    const folderId = await getOrCreateFolderPath(token);
    url = `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,modifiedTime,appProperties`;
    method = 'POST';
    meta = { name: SYNC_FILE, mimeType: 'application/x-sqlite3', parents: [folderId], appProperties: { deviceId } };
  }

  const res = await driveJSON(url, token, {
    method,
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipartBody(meta, binary, boundary),
  });

  return { fileId: res.id, modifiedTime: res.modifiedTime, deviceId };
}

/** Descarga el contenido del archivo de sync por id. Retorna base64. */
export async function downloadSyncFile(token: string, fileId: string): Promise<string> {
  const res = await fetch(`${DRIVE_API}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err?.error?.code === 401) throw new Error('TOKEN_EXPIRED');
    throw new Error(`Error al descargar: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
