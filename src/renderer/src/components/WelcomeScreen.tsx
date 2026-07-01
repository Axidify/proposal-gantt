import { FilePlus2, FolderOpen, Sparkles } from 'lucide-react'

interface Template {
  id: string
  name: string
  description: string
}

interface WelcomeScreenProps {
  onNew: () => void
  onOpen: () => void
  onTemplate: (id: string) => void
  templates: Template[]
}

export function WelcomeScreen({ onNew, onOpen, onTemplate, templates }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <div className="welcome-bg" />
      <div className="welcome-content">
        <div className="welcome-hero">
          <div className="brand-mark brand-mark-lg" />
          <h1>Proposal Gantt</h1>
          <p className="welcome-tagline">
            Create polished project timelines for your pre-sales proposals — drag, edit, and export
            to PDF in minutes.
          </p>
        </div>

        <div className="welcome-actions">
          <button type="button" className="welcome-card" onClick={onNew}>
            <FilePlus2 size={28} />
            <span className="welcome-card-title">Blank proposal</span>
            <span className="welcome-card-desc">Start from scratch with a simple phase template</span>
          </button>
          <button type="button" className="welcome-card" onClick={onOpen}>
            <FolderOpen size={28} />
            <span className="welcome-card-title">Open file</span>
            <span className="welcome-card-desc">Continue working on a saved .pgantt file</span>
          </button>
        </div>

        <section className="welcome-templates">
          <div className="templates-header">
            <Sparkles size={18} />
            <h2>Start from a template</h2>
          </div>
          <div className="template-grid">
            {templates.map((t) => (
              <button key={t.id} type="button" className="template-card" onClick={() => onTemplate(t.id)}>
                <span className="template-name">{t.name}</span>
                <span className="template-desc">{t.description}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
