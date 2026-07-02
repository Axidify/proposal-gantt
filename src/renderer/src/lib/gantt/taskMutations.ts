import type { GanttLink, GanttTask } from '../../types'
import { buildAddTaskInterceptPatch, type AddTaskInterceptEvent, type AddTaskMode } from './intercepts'
import { milestoneTogglePatch, normalizeMilestoneTaskPatch } from '../tasks'

export function insertTaskIntoTree(
  tasks: GanttTask[],
  targetId: number | string | undefined,
  mode: AddTaskMode,
  task: GanttTask
): GanttTask[] {
  if (!tasks.length) return [{ ...task }]

  const newTask: GanttTask = { ...task }
  const targetIndex =
    targetId != null
      ? tasks.findIndex((t) => String(t.id) === String(targetId))
      : tasks.length - 1

  if (mode === 'child' && targetId != null) {
    newTask.parent = targetId
    let insertAt = targetIndex >= 0 ? targetIndex + 1 : tasks.length
    while (insertAt < tasks.length && String(tasks[insertAt].parent) === String(targetId)) {
      insertAt++
    }
    const next = [...tasks]
    next.splice(insertAt, 0, newTask)
    return next
  }

  if (targetIndex < 0) return [...tasks, newTask]

  const target = tasks[targetIndex]
  if (target.parent != null) newTask.parent = target.parent

  const insertAt = mode === 'before' ? targetIndex : targetIndex + 1
  const next = [...tasks]
  next.splice(insertAt, 0, newTask)
  return next
}

export function applyAddTaskRequest(tasks: GanttTask[], request: AddTaskInterceptEvent): GanttTask[] {
  const patch = buildAddTaskInterceptPatch(tasks, request)
  return insertTaskIntoTree(tasks, request.target, patch.mode, patch.task)
}

export function applyMilestoneToggle(
  tasks: GanttTask[],
  taskId: number | string,
  asMilestone: boolean
): GanttTask[] {
  const current = tasks.find((t) => String(t.id) === String(taskId))
  if (!current) return tasks

  const patch = normalizeMilestoneTaskPatch(
    taskId,
    milestoneTogglePatch(current, asMilestone),
    tasks
  )

  return tasks.map((task) =>
    String(task.id) === String(taskId) ? { ...task, ...patch } : task
  )
}

export function collectDescendantIds(
  tasks: GanttTask[],
  rootId: number | string
): Set<string> {
  const ids = new Set<string>([String(rootId)])
  let changed = true
  while (changed) {
    changed = false
    for (const task of tasks) {
      if (task.parent == null) continue
      if (ids.has(String(task.parent)) && !ids.has(String(task.id))) {
        ids.add(String(task.id))
        changed = true
      }
    }
  }
  return ids
}

export function deleteTaskSubtree(
  tasks: GanttTask[],
  links: GanttLink[],
  taskId: number | string
): { tasks: GanttTask[]; links: GanttLink[] } {
  const removeIds = collectDescendantIds(tasks, taskId)
  return {
    tasks: tasks.filter((task) => !removeIds.has(String(task.id))),
    links: links.filter(
      (link) => !removeIds.has(String(link.source)) && !removeIds.has(String(link.target))
    )
  }
}
