import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Gantt, Willow, type IApi } from '@svar-ui/react-gantt'
import '@svar-ui/react-gantt/all.css'
import type { GanttLink, GanttTask, TimelineMode, TimelineZoom } from '../types'
import type { GanttChartActions } from '../lib/ganttActions'
import { addFsDependency, applyFsScheduling, coerceTaskId, FS_LINK_TYPE, removeFsDependency, taskDatesDiffer } from '../lib/dependencies'
import {
  asDate,
  fromCalendarTasks,
  getTimelineColumns,
  getTimelineScales,
  TIMELINE_EPOCH,
  toCalendarTasks
} from '../lib/timeline'
import {
  autofitChart,
  buildZoomConfig,
  defaultChartRange,
  levelToZoomPreset,
  ZOOM_LEVEL_ORDER,
  ZOOM_PRESET_LABELS,
  ZOOM_PRESETS,
  zoomPresetToLevel,
  zoomPresetToTimelineUnit
} from '../lib/ganttZoom'
import { parseISO } from 'date-fns'
import { useDragToLink } from '../hooks/useDragToLink'
import { LinkDragOverlay } from './LinkDragOverlay'
import { AddRowCell } from './AddRowCell'
import { MilestoneToggleCell } from './MilestoneToggleCell'
import { nextTaskId } from '../lib/document'
import { defaultNewTaskStart, normalizeMilestoneTaskPatch, tasksChanged } from '../lib/tasks'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

interface GanttViewProps {
  tasks: GanttTask[]
  links: GanttLink[]
  timelineZoom: TimelineZoom
  timelineMode: TimelineMode
  projectStartDate: string
  onTimelineZoomChange: (zoom: TimelineZoom) => void
  onTimelineModeChange: (mode: TimelineMode) => void
  onTasksChange: (tasks: GanttTask[]) => void
  onLinksChange: (links: GanttLink[]) => void
  onRegisterChartActions?: (actions: GanttChartActions) => void
  chartDocumentKey: string
}

const SYNC_EVENTS = [
  'update-task',
  'add-task',
  'delete-task',
  'update-link',
  'delete-link',
  'copy-task',
  'move-task'
] as const

export function GanttView({
  tasks,
  links,
  timelineZoom,
  timelineMode,
  projectStartDate,
  onTimelineZoomChange,
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
  const dragHadResizeRef = useRef(false)
  const dragInitialWidthRef = useRef<number | null>(null)
  const [linkMode, setLinkMode] = useState(false)
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
  const [chartRange, setChartRange] = useState<{ start: Date; end: Date }>(() =>
    defaultChartRange(tasks, timelineMode, projectStartDate)
  )

  const timelineUnit = zoomPresetToTimelineUnit(timelineZoom)

  const ganttKey = `${chartDocumentKey}-${timelineMode}-${projectStartDate}-${timelineZoom}`

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

  const zoomConfig = useMemo(
    () => buildZoomConfig(timelineMode, timelineZoom),
    [timelineMode, timelineZoom]
  )

  const scales = useMemo(
    () => getTimelineScales(timelineUnit, timelineMode),
    [timelineUnit, timelineMode]
  )

  useEffect(() => {
    setChartRange(defaultChartRange(tasks, timelineMode, projectStartDate))
  }, [chartDocumentKey, timelineMode, projectStartDate])

  const columns = useMemo(() => {
    const [taskCol, ...rest] = getTimelineColumns(timelineUnit, timelineMode)
    return [
      taskCol,
      {
        id: 'milestone-toggle',
        header: '◆',
        width: 36,
        align: 'center' as const,
        resize: false,
        cell: MilestoneToggleCell
      },
      ...rest,
      {
        id: 'add-task',
        header: '',
        width: 56,
        align: 'center' as const,
        resize: false,
        cell: AddRowCell
      }
    ]
  }, [timelineUnit, timelineMode])

  const handleAutofit = useCallback(() => {
    const { range, preset } = autofitChart(ganttTasks)
    setChartRange(range)
    onTimelineZoomChange(preset)
  }, [ganttTasks, onTimelineZoomChange])

  const handleZoomStep = useCallback(
    (dir: 1 | -1) => {
      const currentLevel = zoomPresetToLevel(timelineZoom)
      const nextLevel = Math.min(Math.max(currentLevel + dir, 0), ZOOM_LEVEL_ORDER.length - 1)
      if (nextLevel === currentLevel) return
      onTimelineZoomChange(levelToZoomPreset(nextLevel))
    },
    [onTimelineZoomChange, timelineZoom]
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

  const syncFromApi = useCallback(async (api: IApi) => {
    const { links, timelineMode: mode, projectStartDate: start } = dataRef.current
    const prevTasks = tasksBeforeEditRef.current ?? dataRef.current.tasks
    tasksBeforeEditRef.current = null

    let nextTasks = api.serialize({ data: 'tasks' }) as GanttTask[] | null
    if (!nextTasks) return

    if (mode === 'calendar') {
      nextTasks = fromCalendarTasks(nextTasks, start)
    }

    const barMove = !dragHadResizeRef.current
    dragHadResizeRef.current = false
    dragInitialWidthRef.current = null

    const movedId = movedTaskIdRef.current ?? undefined
    movedTaskIdRef.current = null

    const { tasks: scheduledTasks, links: scheduledLinks } = applyFsScheduling(
      prevTasks,
      nextTasks,
      links,
      movedId,
      { barMove }
    )

    const tasksNeedingChartUpdate = scheduledTasks.filter((task) => {
      const chartTask = nextTasks.find((t) => String(t.id) === String(task.id))
      if (!chartTask) return false
      return taskDatesDiffer(task, chartTask)
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

    if (tasksChanged(dataRef.current.tasks, scheduledTasks)) {
      onTasksChangeRef.current(scheduledTasks)
    }
    if (scheduledLinks !== links) onLinksChangeRef.current(scheduledLinks)
  }, [])

  const handleInit = useCallback(
    (api: IApi) => {
      apiRef.current = api

      api.intercept('add-task', (ev: {
        id?: number | string
        target?: number | string
        mode?: 'before' | 'after' | 'child'
        task?: Partial<GanttTask>
      }) => {
        if (skipApiSync.current || skipLinkIntercept.current) return true

        const { tasks } = dataRef.current
        const newId = nextTaskId(tasks)
        const isPhase = ev.task?.type === 'summary'
        const mode =
          ev.mode ?? (isPhase ? 'after' : tasks.find((t) => String(t.id) === String(ev.target))?.type === 'summary' ? 'child' : 'after')

        ev.id = newId
        ev.mode = mode
        ev.task = {
          type: isPhase ? 'summary' : 'task',
          text: isPhase ? 'New Phase' : 'New Task',
          duration: isPhase ? 14 : 3,
          progress: 0,
          open: isPhase ? true : undefined,
          start: defaultNewTaskStart(tasks, ev.target, mode),
          ...ev.task,
          id: newId
        }
        return true
      })

      api.intercept('update-task', (ev: {
        id?: number | string
        inProgress?: boolean
        task?: Partial<GanttTask>
      }) => {
        if (skipApiSync.current || skipLinkIntercept.current) return true

        if (ev.task && ev.id != null) {
          ev.task = normalizeMilestoneTaskPatch(ev.id, ev.task, dataRef.current.tasks)
        }

        if (ev.inProgress) {
          if (!tasksBeforeEditRef.current) {
            tasksBeforeEditRef.current = structuredClone(dataRef.current.tasks)
          }
          if (ev.id != null) movedTaskIdRef.current = ev.id
        }
        return true
      })

      api.on('drag-task', (ev: {
        id?: number | string
        inProgress?: boolean
        width?: number
      }) => {
        if (skipApiSync.current) return
        if (ev.inProgress) {
          if (!tasksBeforeEditRef.current) {
            tasksBeforeEditRef.current = structuredClone(dataRef.current.tasks)
            dragHadResizeRef.current = false
            dragInitialWidthRef.current = null
          }
          if (ev.id != null) movedTaskIdRef.current = ev.id
          if (typeof ev.width !== 'undefined') {
            if (dragInitialWidthRef.current === null) {
              dragInitialWidthRef.current = ev.width
            } else if (ev.width !== dragInitialWidthRef.current) {
              dragHadResizeRef.current = true
            }
          }
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

        <div className="gantt-zoom-controls" role="group" aria-label="Timeline zoom">
          <button
            type="button"
            className="gantt-tool-btn gantt-tool-icon"
            onClick={() => handleZoomStep(-1)}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} strokeWidth={2} />
          </button>
          <div className="timeline-unit-toggle" role="group" aria-label="Zoom preset">
            {ZOOM_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`gantt-tool-btn${timelineZoom === preset ? ' is-active' : ''}`}
                onClick={() => onTimelineZoomChange(preset)}
                title={ZOOM_PRESET_LABELS[preset]}
              >
                {ZOOM_PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="gantt-tool-btn gantt-tool-icon"
            onClick={() => handleZoomStep(1)}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="gantt-tool-btn gantt-tool-icon"
            onClick={handleAutofit}
            title="Fit timeline to tasks"
            aria-label="Fit timeline to tasks"
          >
            <Maximize2 size={15} strokeWidth={2} />
          </button>
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
          {linkMode ? 'Linking' : 'Link'}
        </button>
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
            start={chartRange.start}
            end={chartRange.end}
            zoom={zoomConfig}
            autoScale={false}
            weekStart={1}
            init={handleInit}
          />
        </Willow>
      </div>
    </div>
  )
}
