import type { IApi } from '@svar-ui/react-gantt'
import type { GanttLink, GanttTask, TimelineMode } from '../../types'
import { asDate, dayOffset } from '../timeline'
import { differenceInCalendarDays } from 'date-fns'

interface GanttLayoutState {
  cellWidth?: number
  _chartWidth?: number
  _tasks?: { $x?: number; $w?: number }[]
  _links?: { $x1?: number; $x2?: number; $p?: string }[]
}

function chartWidthFromDom(): number {
  if (typeof document === 'undefined') return 0
  return document.querySelector('.wx-chart')?.clientWidth ?? 0
}

function taskStartDay(
  task: GanttTask,
  timelineMode: TimelineMode,
  projectStartDate: string
): number {
  const start = asDate(task.start)
  if (Number.isNaN(start.getTime())) return 0
  if (timelineMode === 'calendar' && projectStartDate) {
    return Math.max(0, differenceInCalendarDays(start, new Date(projectStartDate)))
  }
  return Math.max(0, dayOffset(start))
}

/** Estimate horizontal scroll so the earliest task/link is inside SVAR xArea. */
export function syncChartViewport(
  api: IApi,
  tasks: GanttTask[],
  links: GanttLink[],
  timelineMode: TimelineMode,
  projectStartDate: string
): boolean {
  const state = api.getState() as GanttLayoutState
  const chartWidth = state._chartWidth || chartWidthFromDom()
  const cellWidth = state.cellWidth ?? 100
  if (!chartWidth || !tasks.length) return false

  let scrollLeft: number
  const linkedIds = new Set(
    links.flatMap((link) => [String(link.source), String(link.target)])
  )

  const linkedXs: number[] = []
  for (const task of state._tasks ?? []) {
    if (!linkedIds.has(String(task.id))) continue
    if (typeof task.$x === 'number') linkedXs.push(task.$x)
    if (typeof task.$x === 'number' && typeof task.$w === 'number') {
      linkedXs.push(task.$x + task.$w)
    }
  }
  for (const link of state._links ?? []) {
    if (typeof link.$x1 === 'number') linkedXs.push(link.$x1)
    if (typeof link.$x2 === 'number') linkedXs.push(link.$x2)
  }

  if (linkedXs.length) {
    scrollLeft = Math.max(0, Math.min(...linkedXs) - 64)
  } else {
    const relevantTasks =
      linkedIds.size > 0
        ? tasks.filter((task) => linkedIds.has(String(task.id)))
        : tasks
    const minDay = Math.min(
      ...relevantTasks.map((task) => taskStartDay(task, timelineMode, projectStartDate))
    )
    scrollLeft = Math.max(0, minDay * cellWidth - 64)
  }

  void api.exec('scroll-chart', { left: scrollLeft })
  return true
}

export function scheduleChartViewportSync(
  api: IApi,
  tasks: GanttTask[],
  links: GanttLink[],
  timelineMode: TimelineMode,
  projectStartDate: string
): void {
  let attempts = 0
  const trySync = () => {
    const state = api.getState() as GanttLayoutState
    const chartWidth = state._chartWidth || chartWidthFromDom()
    if (chartWidth > 0) {
      syncChartViewport(api, tasks, links, timelineMode, projectStartDate)
      return
    }
    if (attempts++ < 120) requestAnimationFrame(trySync)
  }

  requestAnimationFrame(trySync)
  for (const delay of [50, 200, 500, 1200, 2500]) {
    window.setTimeout(
      () => syncChartViewport(api, tasks, links, timelineMode, projectStartDate),
      delay
    )
  }
}
