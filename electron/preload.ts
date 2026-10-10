import { contextBridge, ipcRenderer } from 'electron';
// Type-only: erased at compile time, so the sandboxed preload still only requires 'electron'.
import type {
  ElectronAuthApi,
  ElectronDBApi,
  ElectronDriveApi,
  ElectronFSApi,
  ElectronReportApi,
} from './ipcContract';

// Sandboxed preloads can't require local modules, so this mirrors
// isAppUrl() in navigationPolicy.ts. If a third-party page ever ends up
// running this preload, it gets no access to the database or file system.
const DEV_SERVER_ORIGIN = 'http://localhost:8081';
const isAppPage = location.protocol === 'app:' || location.origin === DEV_SERVER_ORIGIN;

if (isAppPage) {
  const electronDB: ElectronDBApi = {
    execAsync: (sql) =>
      ipcRenderer.invoke('db:exec', sql),

    runAsync: (sql, params) =>
      ipcRenderer.invoke('db:run', sql, params),

    getAllAsync: (sql, params) =>
      ipcRenderer.invoke('db:getAll', sql, params),

    getFirstAsync: (sql, params) =>
      ipcRenderer.invoke('db:getFirst', sql, params),
  };
  contextBridge.exposeInMainWorld('electronDB', electronDB);

  const electronFS: ElectronFSApi = {
    importDB: () => ipcRenderer.invoke('fs:importDB'),
    exportDB: () => ipcRenderer.invoke('fs:exportDB'),
  };
  contextBridge.exposeInMainWorld('electronFS', electronFS);

  const electronDrive: ElectronDriveApi = {
    readDBAsBase64: () => ipcRenderer.invoke('db:readAsBase64'),
    writeDBFromBase64: (base64) => ipcRenderer.invoke('db:writeFromBase64', base64),
    mergeDBFromBase64: (base64) => ipcRenderer.invoke('db:mergeFromBase64', base64),
    dbSignature: () => ipcRenderer.invoke('db:signature'),
  };
  contextBridge.exposeInMainWorld('electronDrive', electronDrive);

  const electronAuth: ElectronAuthApi = {
    googleOAuth: (params) => ipcRenderer.invoke('auth:googleOAuth', params),
  };
  contextBridge.exposeInMainWorld('electronAuth', electronAuth);

  const electronReport: ElectronReportApi = {
    savePdf: (html, baseName) => ipcRenderer.invoke('report:savePdf', html, baseName),
  };
  contextBridge.exposeInMainWorld('electronReport', electronReport);
}
