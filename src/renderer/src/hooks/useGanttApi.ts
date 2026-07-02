import { useCallback, useEffect, useRef } from 'react'
import type { IApi } from '@svar-ui/react-gantt'
import type { GanttLink, GanttTask, TimelineMode } from '../types'
import type { GanttChartActions } from '../lib/ganttActions'
import { addFsDependency, removeFsDependency } from '../lib/dependencies'
import { fromCalendarTasks, toCalendarTasks, asDate } from '../lib/timeline'
import { tasksChanged } from '../lib/tasks'
import { scheduleFromSerializedTasks } from '../lib/gantt/sync'
import {
  registerGanttApiHandlers,
  type ChartData,
  type DragEditState
} from '../lib/gantt/apiHandlers'

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
  const dragStateRef = useRef<DragEditState>({
    tasksBeforeEdit: null,
    movedTaskId: null,
    dragHadResize: false,
    dragInitialWidth: null
  })

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
    const drag = dragStateRef.current
    const prevTasks = drag.tasksBeforeEdit ?? dataRef.current.tasks
    dragStateRef.current = {
      tasksBeforeEdit: null,
      movedTaskId: null,
      dragHadResize: false,
      dragInitialWidth: null
    }

    let nextTasks = api.serialize({ data: 'tasks' }) as GanttTask[] | null
    if (!nextTasks) return

    if (mode === 'calendar') {
      nextTasks = fromCalendarTasks(nextTasks, start)
    }

    const barMove = !drag.dragHadResize
    const movedId = drag.movedTaskId ?? undefined

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
      registerGanttApiHandlers(api, {
        getData: () => dataRef.current,
        getDragState: () => dragStateRef.current,
        setDragState: (patch) => {
          dragStateRef.current = { ...dragStateRef.current, ...patch }
        },
        shouldSkipApiSync: () => skipApiSync.current,
        shouldSkipLinkIntercept: () => skipLinkIntercept.current,
        onLinkMessage,
        onTasksChange: (tasks) => onTasksChangeRef.current(tasks),
        onLinksChange: (links) => onLinksChangeRef.current(links),
        syncFromApi
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
