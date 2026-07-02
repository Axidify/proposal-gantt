import { useEffect, useState, type RefObject } from 'react'
import { FileText, GitBranch, ListTree, StickyNote } from 'lucide-react'
import type { GanttTask, ProposalDocument } from '../types'
import type { GanttChartActions } from '../lib/ganttActions'
import { zoomPresetToTimelineUnit } from '../lib/ganttZoom'
import { DependenciesPanel } from './DependenciesPanel'
import { TaskPanel } from './TaskPanel'

type InspectorTab = 'proposal' | 'task' | 'links' | 'notes'

interface InspectorPanelProps {
  document: ProposalDocument
  selectedTaskId: number | string | null
  onChange: (updater: (prev: ProposalDocument) => ProposalDocument) => void
  onDirty: () => void
  onTaskChange: (taskId: number | string, patch: Partial<GanttTask>) => void
  onInboundLagChange: (taskId: number | string, lagDays: number) => void
  onDeleteTask: () => void
  chartActionsRef: RefObject<GanttChartActions | null>
}

const TABS: { id: InspectorTab; label: string; icon: typeof FileText }[] = [
  { id: 'proposal', label: 'Proposal', icon: FileText },
  { id: 'task', label: 'Task', icon: ListTree },
  { id: 'links', label: 'Links', icon: GitBranch },
  { id: 'notes', label: 'Notes', icon: StickyNote }
]

export function InspectorPanel({
  document,
  selectedTaskId,
  onChange,
  onDirty,
  onTaskChange,
  onInboundLagChange,
  onDeleteTask,
  chartActionsRef
}: InspectorPanelProps) {
  const [tab, setTab] = useState<InspectorTab>('proposal')

  useEffect(() => {
    if (selectedTaskId != null) setTab('task')
  }, [selectedTaskId])

  const updateMeta = (field: keyof ProposalDocument['meta'], value: string) => {
    onChange((d) => ({
      ...d,
      meta: { ...d.meta, [field]: value }
    }))
    onDirty()
  }

  const calendarMode = document.meta.timelineMode === 'calendar'
  const timelineUnit = zoomPresetToTimelineUnit(document.meta.timelineZoom ?? 'day')

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
        {tab === 'proposal' && (
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

        {tab === 'task' && (
          <TaskPanel
            tasks={document.tasks}
            links={document.links}
            selectedTaskId={selectedTaskId}
            timelineMode={document.meta.timelineMode ?? 'relative'}
            timelineUnit={document.meta.timelineUnit ?? timelineUnit}
            projectStartDate={document.meta.projectStartDate}
            onTaskChange={onTaskChange}
            onInboundLagChange={onInboundLagChange}
            onDeleteTask={onDeleteTask}
          />
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
