import { Trash2 } from 'lucide-react'
import type { GanttLink, GanttTask, TimelineMode, TimelineUnit } from '../types'
import { fsLinks, getFsLag, taskLabel } from '../lib/dependencies'
import {
  formatRelativeDuration,
  formatRelativeStart,
  relativeStartEditValue,
  relativeStartFromEditValue
} from '../lib/timeline'
import { format } from 'date-fns'
import { asDate } from '../lib/timeline'
import { milestoneTogglePatch } from '../lib/tasks'

interface TaskPanelProps {
  tasks: GanttTask[]
  links: GanttLink[]
  selectedTaskId: number | string | null
  timelineMode: TimelineMode
  timelineUnit: TimelineUnit
  onTaskChange: (taskId: number | string, patch: Partial<GanttTask>) => void
  onInboundLagChange: (taskId: number | string, lagDays: number) => void
  onDeleteTask: () => void
}

function inboundLag(
  tasks: GanttTask[],
  links: GanttLink[],
  taskId: number | string
): { predecessor: string; lagDays: number } | null {
  const inbound = fsLinks(links).find((l) => String(l.target) === String(taskId))
  if (!inbound) return null
  return {
    predecessor: taskLabel(tasks, inbound.source),
    lagDays: getFsLag(inbound, tasks)
  }
}

export function TaskPanel({
  tasks,
  links,
  selectedTaskId,
  timelineMode,
  timelineUnit,
  onTaskChange,
  onInboundLagChange,
  onDeleteTask
}: TaskPanelProps) {
  if (selectedTaskId == null) {
    return (
      <div className="inspector-pane inspector-empty" role="tabpanel">
        <p className="inspector-hint">Select a row in the grid or chart to edit task details.</p>
      </div>
    )
  }

  const task = tasks.find((t) => String(t.id) === String(selectedTaskId))
  if (!task) {
    return (
      <div className="inspector-pane inspector-empty" role="tabpanel">
        <p className="inspector-hint">Selected task is no longer in this proposal.</p>
      </div>
    )
  }

  const isSummary = task.type === 'summary'
  const isMilestone = task.type === 'milestone'
  const lag = inboundLag(tasks, links, task.id)
  const childCount = tasks.filter((t) => String(t.parent) === String(task.id)).length

  return (
    <div className="inspector-pane" role="tabpanel">
      <label>
        Name
        <input
          value={task.text}
          onChange={(e) => onTaskChange(task.id, { text: e.target.value || 'Untitled' })}
          placeholder="Task name"
        />
      </label>

      {!isSummary && (
        <fieldset className="inspector-fieldset">
          <legend>Type</legend>
          <label className="inspector-radio">
            <input
              type="radio"
              name="task-type"
              checked={!isMilestone}
              onChange={() => onTaskChange(task.id, milestoneTogglePatch(task, false))}
            />
            Task
          </label>
          <label className="inspector-radio">
            <input
              type="radio"
              name="task-type"
              checked={isMilestone}
              onChange={() => onTaskChange(task.id, milestoneTogglePatch(task, true))}
            />
            Milestone
          </label>
        </fieldset>
      )}

      {isSummary && (
        <p className="inspector-hint">
          Summary phases roll up child dates (auto roll-up in a later release).
          {childCount > 0 ? ` ${childCount} child task${childCount === 1 ? '' : 's'} will also be removed.` : ''}
        </p>
      )}

      {timelineMode === 'calendar' ? (
        <label>
          Start date
          <input
            type="date"
            value={format(asDate(task.start), 'yyyy-MM-dd')}
            onChange={(e) => onTaskChange(task.id, { start: new Date(e.target.value) })}
          />
        </label>
      ) : (
        <label>
          Start
          <input
            type="text"
            inputMode="numeric"
            value={relativeStartEditValue(task.start, timelineUnit)}
            onChange={(e) =>
              onTaskChange(task.id, {
                start: relativeStartFromEditValue(e.target.value, timelineUnit)
              })
            }
          />
          <span className="inspector-field-hint">{formatRelativeStart(task.start, timelineUnit)}</span>
        </label>
      )}

      {!isMilestone && !isSummary && (
        <label>
          {timelineUnit === 'day' ? 'Duration (days)' : 'Duration'}
          <input
            type="number"
            min={1}
            value={task.duration ?? 1}
            onChange={(e) => {
              const duration = Math.max(1, Number.parseInt(e.target.value, 10) || 1)
              onTaskChange(task.id, { duration })
            }}
          />
          <span className="inspector-field-hint">
            {formatRelativeDuration(task.duration ?? 0, timelineUnit)}
          </span>
        </label>
      )}

      {lag ? (
        <label>
          Lag from predecessor ({lag.predecessor})
          <input
            type="number"
            min={0}
            value={lag.lagDays}
            onChange={(e) => {
              const nextLag = Math.max(0, Number.parseInt(e.target.value, 10) || 0)
              onInboundLagChange(task.id, nextLag)
            }}
          />
          <span className="inspector-field-hint">Days between predecessor end and this task start</span>
        </label>
      ) : (
        <div className="inspector-readonly">
          <span className="inspector-label">Lag from predecessor</span>
          <p className="inspector-hint">—</p>
        </div>
      )}

      {task.details && (
        <label>
          Notes
          <textarea value={task.details} rows={4} readOnly />
        </label>
      )}

      <div className="inspector-actions">
        <button type="button" className="btn btn-danger btn-block" onClick={onDeleteTask}>
          <Trash2 size={15} />
          {isSummary ? 'Delete phase' : 'Delete task'}
        </button>
        <p className="inspector-hint">Delete or Backspace when a row is selected</p>
      </div>
    </div>
  )
}
