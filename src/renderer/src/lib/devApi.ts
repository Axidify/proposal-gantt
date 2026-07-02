/**
 * Browser-only dev shim when the renderer runs outside Electron (Vite at localhost:5173).
 */

function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.click()
}

export function installDevApiShim(): void {
  if (typeof window === 'undefined' || window.api) return

  window.api = {
    openFile: async () => {
      console.warn('[Proposal Gantt] Open is unavailable in browser-only dev mode.')
      return null
    },
    saveFile: async (content: string) => {
      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      downloadDataUrl(url, 'proposal.pgantt')
      URL.revokeObjectURL(url)
      return 'proposal.pgantt'
    },
    exportFile: async (dataUrl: string, format: 'png' | 'pdf') => {
      downloadDataUrl(dataUrl, `gantt-chart.${format}`)
      return `gantt-chart.${format}`
    }
  }
}
