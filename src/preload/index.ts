import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  openFile: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke('dialog:open'),
  saveFile: (content: string, currentPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:save', content, currentPath),
  exportFile: (dataUrl: string, format: 'png' | 'pdf'): Promise<string | null> =>
    ipcRenderer.invoke('dialog:export', dataUrl, format)
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)
