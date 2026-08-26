import { contextBridge, ipcRenderer } from 'electron';

// Types for the exposed API
export interface IElectronAPI {
  selectFile: () => Promise<string | undefined>;
  saveFile: (defaultPath: string) => Promise<string | undefined>;
  getAppPath: () => Promise<string>;
  platform: string;
}

const electronAPI: IElectronAPI = {
  selectFile: () => ipcRenderer.invoke('select-file'),
  saveFile: (defaultPath: string) => ipcRenderer.invoke('save-file', defaultPath),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  platform: process.platform,
};

contextBridge.exposeInMainWorld('electron', electronAPI);
