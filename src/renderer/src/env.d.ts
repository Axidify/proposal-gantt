import type { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openFile: () => Promise<{ path: string; content: string } | null>
      saveFile: (content: string, currentPath?: string) => Promise<string | null>
      exportFile: (dataUrl: string, format: 'png' | 'pdf') => Promise<string | null>
    }
  }
}

export {}
