import type { CSSProperties } from 'react'
import {
  FilePlus2,
  FolderOpen,
  Save,
  ImageDown,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Undo2,
  Redo2
} from 'lucide-react'
import type { ThemeId } from '../lib/themes'
import { THEMES } from '../lib/themes'

interface HeaderProps {
  title: string
  dirty: boolean
  filePath?: string
  theme: ThemeId
  inspectorOpen: boolean
  canUndo: boolean
  canRedo: boolean
  onInspectorToggle: () => void
  onThemeChange: (theme: ThemeId) => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
  onExportPng: () => void
  onExportPdf: () => void
}

export function Header({
  title,
  dirty,
  filePath,
  theme,
  inspectorOpen,
  canUndo,
  canRedo,
  onInspectorToggle,
  onThemeChange,
  onNew,
  onOpen,
  onSave,
  onUndo,
  onRedo,
  onExportPng,
  onExportPdf
}: HeaderProps) {
  const fileName = filePath?.split(/[/\\]/).pop()

  return (
    <header className="app-header">
      <div className="header-drag" />

      <div className="header-start">
        <button
          type="button"
          className="btn btn-icon btn-quiet"
          onClick={onInspectorToggle}
          title={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
          aria-expanded={inspectorOpen}
        >
          {inspectorOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        </button>
        <div className="brand-mark" aria-hidden="true" />
        <div className="header-titles">
          <span className="doc-title">
            {title}
            {dirty && <span className="dirty-dot" aria-label="Unsaved changes" />}
          </span>
          <span className="doc-path">{fileName ?? 'Unsaved proposal'}</span>
        </div>
      </div>

      <div className="header-actions">
        <div className="action-group" role="group" aria-label="File">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onNew} title="New (⌘N)">
            <FilePlus2 size={15} />
            <span className="btn-label">New</span>
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpen} title="Open (⌘O)">
            <FolderOpen size={15} />
            <span className="btn-label">Open</span>
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onSave} title="Save (⌘S)">
            <Save size={15} />
            <span className="btn-label">Save</span>
          </button>
        </div>

        <div className="header-divider" aria-hidden="true" />

        <div className="action-group" role="group" aria-label="Edit">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
          >
            <Undo2 size={15} />
            <span className="btn-label">Undo</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
          >
            <Redo2 size={15} />
            <span className="btn-label">Redo</span>
          </button>
        </div>

        <div className="header-divider" aria-hidden="true" />

        <div className="action-group" role="group" aria-label="Export">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onExportPng}>
            <ImageDown size={15} />
            <span className="btn-label">PNG</span>
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onExportPdf}>
            <FileText size={15} />
            <span className="btn-label">Export PDF</span>
          </button>
        </div>

        <div className="header-divider" aria-hidden="true" />

        <div className="theme-swatches" role="radiogroup" aria-label="Accent color">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              aria-label={t.name}
              className={`theme-swatch${theme === t.id ? ' is-active' : ''}`}
              title={t.name}
              style={{ '--swatch': t.accent } as CSSProperties}
              onClick={() => onThemeChange(t.id)}
            />
          ))}
        </div>
      </div>
    </header>
  )
}
