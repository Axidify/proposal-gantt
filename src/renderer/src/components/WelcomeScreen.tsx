import { ArrowRight, FilePlus2, FolderOpen } from 'lucide-react'

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
      <div className="welcome-bg" aria-hidden="true" />
      <div className="welcome-shell">
        <section className="welcome-intro">
          <div className="brand-mark brand-mark-lg" aria-hidden="true" />
          <p className="welcome-eyebrow">Pre-sales timelines</p>
          <h1>Proposal Gantt</h1>
          <p className="welcome-tagline">
            Build credible project timelines with dependencies that behave correctly — then export
            client-ready PDFs in minutes.
          </p>
        </section>

        <section className="welcome-panel">
          <div className="welcome-actions">
            <button type="button" className="welcome-primary" onClick={onNew}>
              <span className="welcome-primary-icon">
                <FilePlus2 size={20} strokeWidth={2} />
              </span>
              <span className="welcome-primary-copy">
                <span className="welcome-primary-title">New proposal</span>
                <span className="welcome-primary-desc">Start with a blank phase structure</span>
              </span>
              <kbd className="welcome-kbd welcome-kbd-inline">⌘N</kbd>
            </button>

            <button type="button" className="welcome-secondary" onClick={onOpen}>
              <FolderOpen size={18} strokeWidth={2} />
              <span>Open existing</span>
              <kbd className="welcome-kbd">⌘O</kbd>
            </button>
          </div>

          <div className="welcome-templates">
            <p className="welcome-section-label">Templates</p>
            <div className="template-list">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="template-row"
                  onClick={() => onTemplate(t.id)}
                >
                  <span className="template-row-copy">
                    <span className="template-name">{t.name}</span>
                    <span className="template-desc">{t.description}</span>
                  </span>
                  <ArrowRight size={16} className="template-row-arrow" />
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
