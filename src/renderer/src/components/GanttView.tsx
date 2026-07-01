import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Gantt, Willow, type IApi } from '@svar-ui/react-gantt'
import '@svar-ui/react-gantt/all.css'
import type { GanttLink, GanttTask, TimelineMode, TimelineUnit } from '../types'
import type { GanttChartActions } from '../lib/ganttActions'
import { addFsDependency, applyFsScheduling, coerceTaskId, FS_LINK_TYPE, removeFsDependency } from '../lib/dependencies'
import {
  asDate,
  fromCalendarTasks,
  getTimelineColumns,
  getTimelineScales,
  TIMELINE_EPOCH,
  toCalendarTasks
} from '../lib/timeline'
import { parseISO } from 'date-fns'
import { useDragToLink } from '../hooks/useDragToLink'
import { LinkDragOverlay } from './LinkDragOverlay'

interface GanttViewProps {
  tasks: GanttTask[]
  links: GanttLink[]
  timelineUnit: TimelineUnit
  timelineMode: TimelineMode
  projectStartDate: string
  onTimelineUnitChange: (unit: TimelineUnit) => void
  onTimelineModeChange: (mode: TimelineMode) => void
  onTasksChange: (tasks: GanttTask[]) => void
  onLinksChange: (links: GanttLink[]) => void
  onRegisterChartActions?: (actions: GanttChartActions) => void
  chartDocumentKey: string
}

const TIMELINE_UNITS: TimelineUnit[] = ['day', 'month', 'year']

const SYNC_EVENTS = [
  'update-task',
  'add-task',
  'delete-task',
  'update-link',
  'delete-link',
  'copy-task',
  'move-task'
] as const

function tasksDiffer(prev: GanttTask[], next: GanttTask[]): boolean {
  return next.some((task) => {
    const prior = prev.find((t) => String(t.id) === String(task.id))
    if (!prior) return true
    return asDate(prior.start).getTime() !== asDate(task.start).getTime()
  })
}

export function GanttView({
  tasks,
  links,
  timelineUnit,
  timelineMode,
  projectStartDate,
  onTimelineUnitChange,
  onTimelineModeChange,
  onTasksChange,
  onLinksChange,
  onRegisterChartActions,
  chartDocumentKey
}: GanttViewProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<IApi | null>(null)
  const dataRef = useRef({ tasks, links, timelineMode, projectStartDate })
  const skipLinkIntercept = useRef(false)
  const skipApiSync = useRef(false)
  const tasksBeforeEditRef = useRef<GanttTask[] | null>(null)
  const movedTaskIdRef = useRef<number | string | null>(null)
  const [linkMode, setLinkMode] = useState(false)
  const [linkMessage, setLinkMessage] = useState<string | null>(null)

  const ganttKey = `${chartDocumentKey}-${timelineUnit}-${timelineMode}-${projectStartDate}`

  const onTasksChangeRef = useRef(onTasksChange)
  const onLinksChangeRef = useRef(onLinksChange)
  onTasksChangeRef.current = onTasksChange
  onLinksChangeRef.current = onLinksChange

  dataRef.current = { tasks, links, timelineMode, projectStartDate }

  const ganttTasks = useMemo(
    () =>
      timelineMode === 'calendar' ? toCalendarTasks(tasks, projectStartDate) : tasks,
    [tasks, timelineMode, projectStartDate]
  )

  const scales = useMemo(
    () => getTimelineScales(timelineUnit, timelineMode),
    [timelineUnit, timelineMode]
  )
  const columns = useMemo(
    () => getTimelineColumns(timelineUnit, timelineMode),
    [timelineUnit, timelineMode]
  )

  const pushTaskUpdatesToChart = useCallback(
    async (
      api: IApi,
      prevTasks: GanttTask[],
      nextTasks: GanttTask[]
    ) => {
      skipLinkIntercept.current = true
      try {
        for (const task of nextTasks) {
          const prev = prevTasks.find((t) => String(t.id) === String(task.id))
          if (!prev) continue
          if (asDate(prev.start).getTime() === asDate(task.start).getTime()) continue

          const chartTask =
            timelineMode === 'calendar'
              ? toCalendarTasks([task], projectStartDate)[0]
              : task
          await api.exec('update-task', {
            id: task.id,
            task: { start: chartTask.start }
          })
        }
      } finally {
        skipLinkIntercept.current = false
      }
    },
    [timelineMode, projectStartDate]
  )

  const applyFsLink = useCallback(
    async (sourceId: string | number, targetId: string | number) => {
      const { tasks: currentTasks, links: currentLinks } = dataRef.current
      const result = addFsDependency(currentTasks, currentLinks, sourceId, targetId)

      if (result.error) {
        if (result.error === 'This FS dependency already exists.') {
          setLinkMessage(null)
          return { ok: true as const }
        }
        setLinkMessage(result.error)
        return { ok: false as const, error: result.error }
      }

      const api = apiRef.current
      if (api) {
        await pushTaskUpdatesToChart(api, currentTasks, result.tasks)
      }

      onTasksChange(result.tasks)
      onLinksChange(result.links)
      setLinkMessage(null)
      return { ok: true as const }
    },
    [onTasksChange, onLinksChange, pushTaskUpdatesToChart]
  )

  const removeFsLinkFromChart = useCallback(
    async (linkId: string | number) => {
      onLinksChange(removeFsDependency(dataRef.current.links, linkId))
      setLinkMessage(null)
    },
    [onLinksChange]
  )

  useEffect(() => {
    onRegisterChartActions?.({
      addFsLink: applyFsLink,
      removeFsLink: removeFsLinkFromChart
    })
  }, [applyFsLink, removeFsLinkFromChart, onRegisterChartActions])

  const drag = useDragToLink(chartRef, linkMode, (sourceId, targetId) => {
    void applyFsLink(coerceTaskId(sourceId), coerceTaskId(targetId))
  })

  const syncFromApi = useCallback(
    async (api: IApi) => {
      const { links, timelineMode: mode, projectStartDate: start } = dataRef.current
      const prevTasks = tasksBeforeEditRef.current ?? dataRef.current.tasks
      tasksBeforeEditRef.current = null

      let nextTasks = api.serialize({ data: 'tasks' }) as GanttTask[] | null

      if (!nextTasks) return

      if (mode === 'calendar') {
        nextTasks = fromCalendarTasks(nextTasks, start)
      }

      const { tasks: scheduledTasks, links: scheduledLinks } = applyFsScheduling(
        prevTasks,
        nextTasks,
        links,
        movedTaskIdRef.current
      )
      movedTaskIdRef.current = null

      const tasksNeedingChartUpdate = scheduledTasks.filter((task) => {
        const chartTask = nextTasks.find((t) => String(t.id) === String(task.id))
        if (!chartTask) return false
        return asDate(task.start).getTime() !== asDate(chartTask.start).getTime()
      })

      if (tasksNeedingChartUpdate.length) {
        skipApiSync.current = true
        try {
          for (const task of tasksNeedingChartUpdate) {
            const chartTask =
              mode === 'calendar' ? toCalendarTasks([task], start)[0] : task
            await api.exec('update-task', {
              id: task.id,
              task: {
                start: chartTask.start,
                ...(chartTask.end ? { end: chartTask.end } : {})
              }
            })
          }
        } finally {
          skipApiSync.current = false
        }
      }

      if (tasksDiffer(dataRef.current.tasks, scheduledTasks)) {
        onTasksChangeRef.current(scheduledTasks)
      }
      if (scheduledLinks !== links) onLinksChangeRef.current(scheduledLinks)
    },
    []
  )

  const handleInit = useCallback(
    (api: IApi) => {
      apiRef.current = api

      api.intercept('update-task', (ev: { id?: number | string; inProgress?: boolean }) => {
        if (skipApiSync.current || skipLinkIntercept.current) return true
        if (ev.inProgress) {
          if (!tasksBeforeEditRef.current) {
            tasksBeforeEditRef.current = structuredClone(dataRef.current.tasks)
          }
          if (ev.id != null) movedTaskIdRef.current = ev.id
        } else if (ev.id != null) {
          movedTaskIdRef.current = ev.id
        }
        return true
      })

      api.on('drag-task', (ev: { id?: number | string; inProgress?: boolean }) => {
        if (ev.inProgress && !skipApiSync.current) {
          tasksBeforeEditRef.current = structuredClone(dataRef.current.tasks)
          if (ev.id != null) movedTaskIdRef.current = ev.id
        }
      })

      api.on('update-task', (ev: { inProgress?: boolean }) => {
        if (ev?.inProgress || skipApiSync.current) return
        queueMicrotask(() => {
          if (!skipApiSync.current) void syncFromApi(api)
        })
      })

      for (const event of SYNC_EVENTS) {
        if (event === 'update-task') continue
        api.on(event, (ev: { inProgress?: boolean }) => {
          if (ev?.inProgress || skipApiSync.current) return
          void syncFromApi(api)
        })
      }

      api.intercept('add-link', (ev: { link: { source: number | string; target: number | string; type?: string } }) => {
        if (skipLinkIntercept.current) return true

        const result = addFsDependency(
          dataRef.current.tasks,
          dataRef.current.links,
          ev.link.source,
          ev.link.target
        )
        if (result.error) {
          if (result.error === 'This FS dependency already exists.') {
            setLinkMessage(null)
            return false
          }
          setLinkMessage(result.error)
          return false
        }

        ev.link.type = FS_LINK_TYPE
        ev.link.source = coerceTaskId(ev.link.source)
        ev.link.target = coerceTaskId(ev.link.target)

        queueMicrotask(() => {
          onTasksChangeRef.current(result.tasks)
          onLinksChangeRef.current(result.links)
          setLinkMessage(null)
        })
        return true
      })

      api.intercept('delete-link', () => {
        if (skipLinkIntercept.current) return true
        queueMicrotask(() => {
          const serialized = api.serialize({ data: 'links' }) as GanttLink[] | null
          if (serialized) onLinksChangeRef.current(serialized)
        })
        return true
      })
    },
    [syncFromApi]
  )

  const chartStart =
    timelineMode === 'calendar' ? parseISO(projectStartDate) : TIMELINE_EPOCH

  return (
    <div
      className={`gantt-chart proposal-gantt-theme${linkMode ? ' link-mode-active' : ''}${drag ? ' link-dragging' : ''}`}
    >
      <div className="gantt-toolbar">
        <div className="timeline-unit-toggle" role="group" aria-label="Timeline mode">
          <button
            type="button"
            className={`gantt-tool-btn${timelineMode === 'relative' ? ' is-active' : ''}`}
            onClick={() => onTimelineModeChange('relative')}
          >
            Relative
          </button>
          <button
            type="button"
            className={`gantt-tool-btn${timelineMode === 'calendar' ? ' is-active' : ''}`}
            onClick={() => onTimelineModeChange('calendar')}
          >
            Start date
          </button>
        </div>

        <span className="toolbar-divider" />

        <div className="timeline-unit-toggle" role="group" aria-label="Timeline scale">
          {TIMELINE_UNITS.map((unit) => (
            <button
              key={unit}
              type="button"
              className={`gantt-tool-btn${timelineUnit === unit ? ' is-active' : ''}`}
              onClick={() => onTimelineUnitChange(unit)}
            >
              {unit.charAt(0).toUpperCase() + unit.slice(1)}s
            </button>
          ))}
        </div>

        <span className="toolbar-divider" />

        <button
          type="button"
          className={`gantt-tool-btn${linkMode ? ' is-active' : ''}`}
          onClick={() => {
            setLinkMode((on) => !on)
            setLinkMessage(null)
          }}
        >
          {linkMode ? 'Link mode on' : 'Link mode off'}
        </button>
        <span className="gantt-tool-hint">
          {linkMode
            ? 'Link mode: hover a task, then drag right dot → left dot.'
            : 'Drag task bars to reschedule. Linked tasks keep their gap.'}
        </span>
        {linkMessage && <span className="gantt-tool-error">{linkMessage}</span>}
      </div>

      <div ref={chartRef} className="gantt-chart-body">
        <LinkDragOverlay drag={drag} />
        <Willow>
          <Gantt
            key={ganttKey}
            tasks={ganttTasks}
            links={links}
            scales={scales}
            columns={columns}
            start={chartStart}
            init={handleInit}
          />
        </Willow>
      </div>
    </div>
  )
}
