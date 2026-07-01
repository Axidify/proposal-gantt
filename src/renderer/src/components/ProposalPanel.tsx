import type { RefObject } from 'react'
import type { ProposalDocument } from '../types'
import type { GanttChartActions } from '../lib/ganttActions'
import { DependenciesPanel } from './DependenciesPanel'

interface ProposalPanelProps {
  document: ProposalDocument
  onChange: (updater: (prev: ProposalDocument) => ProposalDocument) => void
  onDirty: () => void
  chartActionsRef: RefObject<GanttChartActions | null>
}

export function ProposalPanel({ document, onChange, onDirty, chartActionsRef }: ProposalPanelProps) {
  const updateMeta = (field: keyof ProposalDocument['meta'], value: string) => {
    onChange((d) => ({
      ...d,
      meta: { ...d.meta, [field]: value }
    }))
    onDirty()
  }

  const calendarMode = document.meta.timelineMode === 'calendar'

  return (
    <aside className="proposal-panel">
      <section className="panel-section">
        <h3>Proposal Details</h3>
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
      </section>

      <section className="panel-section">
        <h3>Timeline</h3>
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
          <p className="panel-desc">
            Using a relative timeline. Switch to <strong>Start date</strong> above the chart to
            map tasks to calendar dates.
          </p>
        )}
      </section>

      <section className="panel-section">
        <h3>Notes</h3>
        <textarea
          value={document.meta.notes}
          onChange={(e) => updateMeta('notes', e.target.value)}
          placeholder="Assumptions, scope notes, or footnotes for the proposal..."
          rows={5}
        />
      </section>

      <DependenciesPanel
        document={document}
        onChange={onChange}
        onDirty={onDirty}
        chartActionsRef={chartActionsRef}
      />

      <section className="panel-section panel-hint">
        <h3>Tips</h3>
        <ul>
          <li>Toggle Relative or Start date above the chart</li>
          <li>Toggle Days / Months / Years for scale</li>
          <li>Double-click tasks on the chart to edit</li>
          <li>Drag task bars to reschedule (linked tasks keep their gap)</li>
          <li>Add FS dependencies in the sidebar</li>
          <li>Hover a task in link mode, then drag right dot → left dot</li>
          <li>Export PDF for client proposals</li>
        </ul>
      </section>
    </aside>
  )
}
