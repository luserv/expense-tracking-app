/**
 * Types-only contract for the bridges that electron/preload.ts exposes on
 * `window` through contextBridge. Shared by the preload (which implements
 * them), the main process (which answers the IPC calls) and the renderer
 * (utils/db.ts declares them on Window). Must never contain runtime code:
 * the sandboxed preload can only import it with `import type`.
 */

/** Result of an IPC operation that can succeed, be canceled by the user or fail. */
export interface IpcOutcome {
  success?: true;
  canceled?: true;
  error?: string;
}

export interface ElectronDBApi {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<void>;
  getAllAsync(sql: string, params?: unknown[]): Promise<unknown[]>;
  getFirstAsync(sql: string, params?: unknown[]): Promise<unknown | null>;
}

export interface ElectronFSApi {
  importDB(): Promise<IpcOutcome>;
  exportDB(): Promise<IpcOutcome>;
}

export interface ElectronDriveApi {
  readDBAsBase64(): Promise<string>;
  writeDBFromBase64(base64: string): Promise<IpcOutcome>;
  mergeDBFromBase64(base64: string): Promise<IpcOutcome>;
  dbSignature(): Promise<string>;
}

export interface GoogleOAuthParams {
  authUrl: string;
  redirectUri: string;
}

export interface GoogleOAuthTokens {
  access_token: string;
  id_token: string;
}

export interface ElectronAuthApi {
  googleOAuth(params: GoogleOAuthParams): Promise<GoogleOAuthTokens>;
}

export interface ElectronReportApi {
  savePdf(html: string, baseName: string): Promise<IpcOutcome>;
}
