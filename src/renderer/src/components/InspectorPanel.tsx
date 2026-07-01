import { useState, type RefObject } from 'react'
import { FileText, GitBranch, StickyNote } from 'lucide-react'
import type { ProposalDocument } from '../types'
import type { GanttChartActions } from '../lib/ganttActions'
import { DependenciesPanel } from './DependenciesPanel'

type InspectorTab = 'details' | 'links' | 'notes'

interface InspectorPanelProps {
  document: ProposalDocument
  onChange: (updater: (prev: ProposalDocument) => ProposalDocument) => void
  onDirty: () => void
  chartActionsRef: RefObject<GanttChartActions | null>
}

const TABS: { id: InspectorTab; label: string; icon: typeof FileText }[] = [
  { id: 'details', label: 'Details', icon: FileText },
  { id: 'links', label: 'Links', icon: GitBranch },
  { id: 'notes', label: 'Notes', icon: StickyNote }
]

export function InspectorPanel({
  document,
  onChange,
  onDirty,
  chartActionsRef
}: InspectorPanelProps) {
  const [tab, setTab] = useState<InspectorTab>('details')

  const updateMeta = (field: keyof ProposalDocument['meta'], value: string) => {
    onChange((d) => ({
      ...d,
      meta: { ...d.meta, [field]: value }
    }))
    onDirty()
  }

  const calendarMode = document.meta.timelineMode === 'calendar'

  return (
    <aside className="inspector">
      <nav className="inspector-tabs" role="tablist" aria-label="Proposal inspector">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`inspector-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={15} strokeWidth={2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="inspector-body">
        {tab === 'details' && (
          <div className="inspector-pane" role="tabpanel">
            <label>
              Title
              <input
                value={document.meta.title}
                onChange={(e) => updateMeta('title', e.target.value)}
                placeholder="Project name"
              />
            </label>
            <label>
              Client
              <input
                value={document.meta.client}
                onChange={(e) => updateMeta('client', e.target.value)}
                placeholder="Client organization"
              />
            </label>
            <label>
              Prepared by
              <input
                value={document.meta.preparedBy}
                onChange={(e) => updateMeta('preparedBy', e.target.value)}
                placeholder="Your name or team"
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={document.meta.date}
                onChange={(e) => updateMeta('date', e.target.value)}
              />
            </label>

            <div className="inspector-divider" />

            <p className="inspector-label">Timeline</p>
            {calendarMode ? (
              <label>
                Project start (Day 1)
                <input
                  type="date"
                  value={document.meta.projectStartDate ?? ''}
                  onChange={(e) => updateMeta('projectStartDate', e.target.value)}
                />
              </label>
            ) : (
              <p className="inspector-hint">
                Relative mode — switch to <strong>Start date</strong> in the chart toolbar to
                map tasks to calendar dates.
              </p>
            )}
          </div>
        )}

        {tab === 'links' && (
          <div className="inspector-pane" role="tabpanel">
            <DependenciesPanel
              document={document}
              onChange={onChange}
              onDirty={onDirty}
              chartActionsRef={chartActionsRef}
              embedded
            />
          </div>
        )}

        {tab === 'notes' && (
          <div className="inspector-pane" role="tabpanel">
            <label>
              Footnotes
              <textarea
                value={document.meta.notes}
                onChange={(e) => updateMeta('notes', e.target.value)}
                placeholder="Assumptions, scope notes, or footnotes for the proposal..."
                rows={12}
              />
            </label>
          </div>
        )}
      </div>
    </aside>
  )
}
