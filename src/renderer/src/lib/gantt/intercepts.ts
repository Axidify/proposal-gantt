import type { GanttTask } from '../../types'
import { nextTaskId } from '../document'
import { defaultNewTaskStart } from '../tasks'

export type AddTaskMode = 'before' | 'after' | 'child'

export interface AddTaskInterceptEvent {
  id?: number | string
  target?: number | string
  mode?: AddTaskMode
  task?: Partial<GanttTask>
}

export function resolveAddTaskMode(
  tasks: GanttTask[],
  targetId: number | string | undefined,
  requestedMode?: AddTaskMode,
  incomingType?: string
): AddTaskMode {
  if (requestedMode) return requestedMode
  if (incomingType === 'summary') return 'after'

  const target = targetId != null ? tasks.find((t) => String(t.id) === String(targetId)) : undefined
  return target?.type === 'summary' ? 'child' : 'after'
}

export function buildAddTaskInterceptPatch(
  tasks: GanttTask[],
  ev: AddTaskInterceptEvent
): { id: number | string; mode: AddTaskMode; task: GanttTask } {
  const newId = nextTaskId(tasks)
  const isPhase = ev.task?.type === 'summary'
  const mode = resolveAddTaskMode(tasks, ev.target, ev.mode, ev.task?.type)

  return {
    id: newId,
    mode,
    task: {
      type: isPhase ? 'summary' : 'task',
      text: isPhase ? 'New Phase' : 'New Task',
      duration: isPhase ? 14 : 3,
      progress: 0,
      open: isPhase ? true : undefined,
      start: defaultNewTaskStart(tasks, ev.target, mode),
      ...ev.task,
      id: newId
    }
  }
}

/** Apply a grid reparent (change `parent` on one task). Used by tests and future undo. */
export function reparentTask(
  tasks: GanttTask[],
  taskId: number | string,
  newParent: number | string | undefined
): GanttTask[] {
  return tasks.map((task) =>
    String(task.id) === String(taskId) ? { ...task, parent: newParent } : task
  )
}

export const GANTT_SYNC_EVENTS = [
  'update-task',
  'add-task',
  'delete-task',
  'update-link',
  'delete-link',
  'copy-task',
  'move-task'
] as const

export type GanttSyncEvent = (typeof GANTT_SYNC_EVENTS)[number]
