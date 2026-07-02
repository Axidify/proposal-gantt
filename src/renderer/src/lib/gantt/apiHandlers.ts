import type { IApi } from '@svar-ui/react-gantt'
import type { GanttLink, GanttTask, TimelineMode, ChartInteractionMode } from '../../types'
import {
  addFsDependency,
  coerceTaskId,
  FS_LINK_TYPE
} from '../dependencies'
import { normalizeMilestoneTaskPatch } from '../tasks'
import {
  buildAddTaskInterceptPatch,
  GANTT_SYNC_EVENTS,
  type AddTaskInterceptEvent
} from './intercepts'
import { applyAddTaskRequest, deleteTaskSubtree } from './taskMutations'

export interface ChartData {
  tasks: GanttTask[]
  links: GanttLink[]
  timelineMode: TimelineMode
  projectStartDate: string
}

export interface DragEditState {
  tasksBeforeEdit: GanttTask[] | null
  movedTaskId: number | string | null
  dragHadResize: boolean
  dragInitialWidth: number | null
}

export interface GanttApiHandlerContext {
  getData: () => ChartData
  getDragState: () => DragEditState
  setDragState: (patch: Partial<DragEditState>) => void
  getInteractionMode: () => ChartInteractionMode
  shouldSkipApiSync: () => boolean
  shouldSkipLinkIntercept: () => boolean
  onLinkMessage: (message: string | null) => void
  onTasksChange: (tasks: GanttTask[]) => void
  onLinksChange: (links: GanttLink[]) => void
  onSelectedTaskChange?: (taskId: number | string | null) => void
  syncFromApi: (api: IApi) => Promise<void>
}

export function registerGanttApiHandlers(api: IApi, ctx: GanttApiHandlerContext): void {
  api.intercept('drag-task', (ev: { inProgress?: boolean }) => {
    if (ctx.getInteractionMode() === 'select') return false
    return true
  })

  api.intercept('move-task', () => {
    const mode = ctx.getInteractionMode()
    if (mode === 'schedule' || mode === 'link') return false
    return true
  })

  api.on('select-task', (ev: { id?: number | string }) => {
    if (ev.id != null) ctx.onSelectedTaskChange?.(ev.id)
  })

  api.intercept('delete-task', (ev: { id?: number | string }) => {
    if (ctx.shouldSkipApiSync() || ctx.shouldSkipLinkIntercept()) return true
    if (ev.id == null) return false

    const { tasks, links } = ctx.getData()
    const result = deleteTaskSubtree(tasks, links, ev.id)
    ctx.onTasksChange(result.tasks)
    ctx.onLinksChange(result.links)
    return false
  })

  api.intercept('add-task', (ev: AddTaskInterceptEvent) => {
    if (ctx.shouldSkipApiSync() || ctx.shouldSkipLinkIntercept()) return true

    const patch = buildAddTaskInterceptPatch(ctx.getData().tasks, ev)
    ev.id = patch.id
    ev.mode = patch.mode
    ev.task = patch.task

    ctx.onTasksChange(applyAddTaskRequest(ctx.getData().tasks, ev))
    return false
  })

  api.intercept('update-task', (ev: {
    id?: number | string
    inProgress?: boolean
    task?: Partial<GanttTask>
  }) => {
    if (ctx.shouldSkipApiSync() || ctx.shouldSkipLinkIntercept()) return true

    if (ev.task && ev.id != null) {
      ev.task = normalizeMilestoneTaskPatch(ev.id, ev.task, ctx.getData().tasks)
    }

    if (ev.inProgress) {
      const drag = ctx.getDragState()
      if (!drag.tasksBeforeEdit) {
        ctx.setDragState({ tasksBeforeEdit: structuredClone(ctx.getData().tasks) })
      }
      if (ev.id != null) ctx.setDragState({ movedTaskId: ev.id })
    }
    return true
  })

  api.on('drag-task', (ev: {
    id?: number | string
    inProgress?: boolean
    width?: number
  }) => {
    if (ctx.shouldSkipApiSync()) return
    if (!ev.inProgress) return

    const drag = ctx.getDragState()
    if (!drag.tasksBeforeEdit) {
      ctx.setDragState({
        tasksBeforeEdit: structuredClone(ctx.getData().tasks),
        dragHadResize: false,
        dragInitialWidth: null
      })
    }
    if (ev.id != null) ctx.setDragState({ movedTaskId: ev.id })

    if (typeof ev.width !== 'undefined') {
      const initial = drag.dragInitialWidth
      if (initial === null) {
        ctx.setDragState({ dragInitialWidth: ev.width })
      } else if (ev.width !== initial) {
        ctx.setDragState({ dragHadResize: true })
      }
    }
  })

  api.on('update-task', (ev: { inProgress?: boolean }) => {
    if (ev?.inProgress || ctx.shouldSkipApiSync()) return
    queueMicrotask(() => {
      if (!ctx.shouldSkipApiSync()) void ctx.syncFromApi(api)
    })
  })

  for (const event of GANTT_SYNC_EVENTS) {
    if (event === 'update-task') continue
    api.on(event, (ev: { inProgress?: boolean }) => {
      if (ev?.inProgress || ctx.shouldSkipApiSync()) return
      queueMicrotask(() => {
        if (!ctx.shouldSkipApiSync()) void ctx.syncFromApi(api)
      })
    })
  }

  api.intercept('add-link', (ev: {
    link: { source: number | string; target: number | string; type?: string }
  }) => {
    if (ctx.shouldSkipLinkIntercept()) return true

    const { tasks, links } = ctx.getData()
    const result = addFsDependency(tasks, links, ev.link.source, ev.link.target)
    if (result.error) {
      if (result.error === 'This FS dependency already exists.') {
        ctx.onLinkMessage(null)
        return false
      }
      ctx.onLinkMessage(result.error)
      return false
    }

    ev.link.type = FS_LINK_TYPE
    ev.link.source = coerceTaskId(ev.link.source)
    ev.link.target = coerceTaskId(ev.link.target)

    queueMicrotask(() => {
      ctx.onTasksChange(result.tasks)
      ctx.onLinksChange(result.links)
      ctx.onLinkMessage(null)
    })
    return true
  })

  api.intercept('delete-link', () => {
    if (ctx.shouldSkipLinkIntercept()) return true
    queueMicrotask(() => {
      const serialized = api.serialize({ data: 'links' }) as GanttLink[] | null
      if (serialized) ctx.onLinksChange(serialized)
    })
    return true
  })
}
