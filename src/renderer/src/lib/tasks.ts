import { addDays } from 'date-fns'
import type { GanttTask } from '../types'
import { getTaskEnd } from './dependencies'
import { asDate } from './timeline'

export function milestoneTogglePatch(
  task: Pick<GanttTask, 'start' | 'duration' | 'progress' | 'type'>,
  asMilestone: boolean
): Partial<GanttTask> {
  if (asMilestone) {
    const start = asDate(task.start)
    return { type: 'milestone', duration: 0, progress: 0, end: start }
  }
  const duration = task.duration && task.duration > 0 ? task.duration : 3
  return { type: 'task', duration, progress: task.progress ?? 0, end: undefined }
}

export function normalizeMilestoneTaskPatch(
  taskId: number | string,
  patch: Partial<GanttTask>,
  tasks: GanttTask[]
): Partial<GanttTask> {
  if (patch.type === 'milestone') {
    const start = patch.start ?? tasks.find((t) => String(t.id) === String(taskId))?.start
    return { ...patch, duration: 0, progress: 0, end: start ? asDate(start) : undefined }
  }
  if (patch.type === 'task') {
    const current = tasks.find((t) => String(t.id) === String(taskId))
    if (current?.type === 'milestone' && (patch.duration == null || patch.duration === 0)) {
      return { ...patch, duration: 3, progress: patch.progress ?? 0 }
    }
  }
  return patch
}

export function tasksChanged(prev: GanttTask[], next: GanttTask[]): boolean {
  if (prev.length !== next.length) return true
  return next.some((task) => {
    const prior = prev.find((t) => String(t.id) === String(task.id))
    if (!prior) return true
    return (
      prior.text !== task.text ||
      prior.type !== task.type ||
      String(prior.parent ?? '') !== String(task.parent ?? '') ||
      prior.duration !== task.duration ||
      prior.progress !== task.progress ||
      prior.open !== task.open ||
      asDate(prior.start).getTime() !== asDate(task.start).getTime()
    )
  })
}

export function defaultNewTaskStart(
  tasks: GanttTask[],
  targetId?: number | string,
  mode: 'before' | 'after' | 'child' = 'after'
): Date {
  const target = targetId != null ? tasks.find((t) => String(t.id) === String(targetId)) : undefined
  if (!target) {
    const latest = tasks.reduce<GanttTask | null>((best, task) => {
      if (!best) return task
      return asDate(task.start).getTime() > asDate(best.start).getTime() ? task : best
    }, null)
    return latest ? addDays(getTaskEnd(latest), 0) : asDate(tasks[0]?.start ?? new Date())
  }

  const parentId = mode === 'child' ? target.id : target.parent
  const siblings = tasks.filter((t) => String(t.parent ?? '') === String(parentId ?? ''))

  if (!siblings.length) return asDate(target.start)

  const latest = siblings.reduce((best, task) =>
    asDate(task.start).getTime() >= asDate(best.start).getTime() ? task : best
  )
  return addDays(getTaskEnd(latest), 0)
}
