import {
  FilePlus2,
  FolderOpen,
  Save,
  ImageDown,
  FileText,
  Palette
} from 'lucide-react'
import type { ThemeId } from '../lib/themes'
import { THEMES } from '../lib/themes'

interface HeaderProps {
  title: string
  dirty: boolean
  filePath?: string
  theme: ThemeId
  onThemeChange: (theme: ThemeId) => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onExportPng: () => void
  onExportPdf: () => void
}

export function Header({
  title,
  dirty,
  filePath,
  theme,
  onThemeChange,
  onNew,
  onOpen,
  onSave,
  onExportPng,
  onExportPdf
}: HeaderProps) {
  const fileName = filePath?.split(/[/\\]/).pop()

  return (
    <header className="app-header">
      <div className="header-drag" />
      <div className="header-brand">
        <div className="brand-mark" />
        <div>
          <span className="brand-name">Proposal Gantt</span>
          <span className="doc-title">
            {title}
            {dirty ? ' •' : ''}
          </span>
        </div>
      </div>

      <div className="header-actions">
        <button type="button" className="btn btn-ghost" onClick={onNew} title="New (⌘N)">
          <FilePlus2 size={16} />
          New
        </button>
        <button type="button" className="btn btn-ghost" onClick={onOpen} title="Open (⌘O)">
          <FolderOpen size={16} />
          Open
        </button>
        <button type="button" className="btn btn-ghost" onClick={onSave} title="Save (⌘S)">
          <Save size={16} />
          Save
        </button>

        <span className="header-divider" />

        <button type="button" className="btn btn-ghost" onClick={onExportPng}>
          <ImageDown size={16} />
          PNG
        </button>
        <button type="button" className="btn btn-primary" onClick={onExportPdf}>
          <FileText size={16} />
          Export PDF
        </button>

        <span className="header-divider" />

        <label className="theme-picker">
          <Palette size={16} />
          <select value={theme} onChange={(e) => onThemeChange(e.target.value as ThemeId)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {fileName && <span className="file-badge">{fileName}</span>}
    </header>
  )
}
