import { useCallback, useEffect, useRef } from 'react'
import type { IApi } from '@svar-ui/react-gantt'
import type { GanttLink, GanttTask, TimelineMode } from '../types'
import type { GanttChartActions } from '../lib/ganttActions'
import {
  addFsDependency,
  coerceTaskId,
  FS_LINK_TYPE,
  removeFsDependency
} from '../lib/dependencies'
import { fromCalendarTasks, toCalendarTasks, asDate } from '../lib/timeline'
import { nextTaskId } from '../lib/document'
import { defaultNewTaskStart, normalizeMilestoneTaskPatch, tasksChanged } from '../lib/tasks'
import { scheduleFromSerializedTasks } from '../lib/gantt/sync'

const SYNC_EVENTS = [
  'update-task',
  'add-task',
  'delete-task',
  'update-link',
  'delete-link',
  'copy-task',
  'move-task'
] as const

interface ChartData {
  tasks: GanttTask[]
  links: GanttLink[]
  timelineMode: TimelineMode
  projectStartDate: string
}

interface UseGanttApiOptions {
  onTasksChange: (tasks: GanttTask[]) => void
  onLinksChange: (links: GanttLink[]) => void
  onRegisterChartActions?: (actions: GanttChartActions) => void
  onLinkMessage: (message: string | null) => void
}

export function useGanttApi({
  onTasksChange,
  onLinksChange,
  onRegisterChartActions,
  onLinkMessage
}: UseGanttApiOptions) {
  const apiRef = useRef<IApi | null>(null)
  const dataRef = useRef<ChartData>({
    tasks: [],
    links: [],
    timelineMode: 'relative',
    projectStartDate: ''
  })
  const skipLinkIntercept = useRef(false)
  const skipApiSync = useRef(false)
  const tasksBeforeEditRef = useRef<GanttTask[] | null>(null)
  const movedTaskIdRef = useRef<number | string | null>(null)
  const dragHadResizeRef = useRef(false)
  const dragInitialWidthRef = useRef<number | null>(null)

  const onTasksChangeRef = useRef(onTasksChange)
  const onLinksChangeRef = useRef(onLinksChange)
  onTasksChangeRef.current = onTasksChange
  onLinksChangeRef.current = onLinksChange

  const setChartData = useCallback((data: ChartData) => {
    dataRef.current = data
  }, [])

  const pushTaskUpdatesToChart = useCallback(
    async (api: IApi, prevTasks: GanttTask[], nextTasks: GanttTask[]) => {
      const { timelineMode, projectStartDate } = dataRef.current
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
    []
  )

  const applyFsLink = useCallback(
    async (sourceId: string | number, targetId: string | number) => {
      const { tasks: currentTasks, links: currentLinks } = dataRef.current
      const result = addFsDependency(currentTasks, currentLinks, sourceId, targetId)

      if (result.error) {
        if (result.error === 'This FS dependency already exists.') {
          onLinkMessage(null)
          return { ok: true as const }
        }
        onLinkMessage(result.error)
        return { ok: false as const, error: result.error }
      }

      const api = apiRef.current
      if (api) {
        await pushTaskUpdatesToChart(api, currentTasks, result.tasks)
      }

      onTasksChange(result.tasks)
      onLinksChange(result.links)
      onLinkMessage(null)
      return { ok: true as const }
    },
    [onTasksChange, onLinksChange, onLinkMessage, pushTaskUpdatesToChart]
  )

  const removeFsLinkFromChart = useCallback(
    async (linkId: string | number) => {
      onLinksChange(removeFsDependency(dataRef.current.links, linkId))
      onLinkMessage(null)
    },
    [onLinksChange, onLinkMessage]
  )

  useEffect(() => {
    onRegisterChartActions?.({
      addFsLink: applyFsLink,
      removeFsLink: removeFsLinkFromChart
    })
  }, [applyFsLink, removeFsLinkFromChart, onRegisterChartActions])

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

    const { scheduledTasks, scheduledLinks, tasksNeedingChartUpdate } =
      scheduleFromSerializedTasks({
        prevTasks,
        nextTasks,
        links,
        movedId,
        barMove
      })

    if (tasksNeedingChartUpdate.length) {
      skipApiSync.current = true
      try {
        for (const task of tasksNeedingChartUpdate) {
          const chartTask = mode === 'calendar' ? toCalendarTasks([task], start)[0] : task
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
          ev.mode ??
          (isPhase
            ? 'after'
            : tasks.find((t) => String(t.id) === String(ev.target))?.type === 'summary'
              ? 'child'
              : 'after')

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

      api.intercept('add-link', (ev: {
        link: { source: number | string; target: number | string; type?: string }
      }) => {
        if (skipLinkIntercept.current) return true

        const result = addFsDependency(
          dataRef.current.tasks,
          dataRef.current.links,
          ev.link.source,
          ev.link.target
        )
        if (result.error) {
          if (result.error === 'This FS dependency already exists.') {
            onLinkMessage(null)
            return false
          }
          onLinkMessage(result.error)
          return false
        }

        ev.link.type = FS_LINK_TYPE
        ev.link.source = coerceTaskId(ev.link.source)
        ev.link.target = coerceTaskId(ev.link.target)

        queueMicrotask(() => {
          onTasksChangeRef.current(result.tasks)
          onLinksChangeRef.current(result.links)
          onLinkMessage(null)
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
    [onLinkMessage, syncFromApi]
  )

  return {
    handleInit,
    applyFsLink,
    setChartData
  }
}
