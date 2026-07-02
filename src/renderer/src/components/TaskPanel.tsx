import type { GanttLink, GanttTask, TimelineMode, TimelineUnit } from '../types'
import { fsLinks, getFsLag, taskLabel } from '../lib/dependencies'
import {
  asDate,
  formatRelativeDuration,
  formatRelativeStart,
  fromCalendarTasks,
  relativeStartEditValue,
  relativeStartFromEditValue,
  toCalendarTasks
} from '../lib/timeline'
import { format } from 'date-fns'
import { milestoneTogglePatch } from '../lib/tasks'

interface TaskPanelProps {
  tasks: GanttTask[]
  links: GanttLink[]
  selectedTaskId: number | string | null
  timelineMode: TimelineMode
  timelineUnit: TimelineUnit
  projectStartDate?: string
  onTaskChange: (taskId: number | string, patch: Partial<GanttTask>) => void
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
  projectStartDate,
  onTaskChange
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
  const calendarStart =
    timelineMode === 'calendar' && projectStartDate
      ? toCalendarTasks([task], projectStartDate)[0].start
      : task.start

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

      {isSummary && <p className="inspector-hint">Summary phases roll up child dates (auto roll-up in a later release).</p>}

      {timelineMode === 'calendar' ? (
        <label>
          Start date
          <input
            type="date"
            value={format(asDate(calendarStart), 'yyyy-MM-dd')}
            onChange={(e) => {
              const picked = new Date(e.target.value)
              if (projectStartDate) {
                const relative = fromCalendarTasks([{ ...task, start: picked }], projectStartDate)[0]
                onTaskChange(task.id, { start: relative.start })
              } else {
                onTaskChange(task.id, { start: picked })
              }
            }}
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
        <div className="inspector-readonly">
          <span className="inspector-label">Lag from predecessor</span>
          <p>
            {lag.predecessor} → {lag.lagDays} day{lag.lagDays === 1 ? '' : 's'}
          </p>
        </div>
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
    </div>
  )
}
