import type { GanttLink, GanttTask } from '../../types'
import { applyFsScheduling, taskDatesDiffer } from '../dependencies'

export function scheduleFromSerializedTasks({
  prevTasks,
  nextTasks,
  links,
  movedId,
  barMove
}: {
  prevTasks: GanttTask[]
  nextTasks: GanttTask[]
  links: GanttLink[]
  movedId?: number | string
  barMove: boolean
}): {
  scheduledTasks: GanttTask[]
  scheduledLinks: GanttLink[]
  tasksNeedingChartUpdate: GanttTask[]
} {
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

  return { scheduledTasks, scheduledLinks, tasksNeedingChartUpdate }
}
