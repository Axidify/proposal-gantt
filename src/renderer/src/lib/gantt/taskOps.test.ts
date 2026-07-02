import { addDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import type { GanttTask } from '../types'
import { TIMELINE_EPOCH } from '../timeline'
import { tasksChanged } from '../tasks'
import {
  buildAddTaskInterceptPatch,
  reparentTask,
  resolveAddTaskMode
} from './intercepts'
import { scheduleFromSerializedTasks } from './sync'

function phase(id: number, startDay = 0): GanttTask {
  return {
    id,
    text: `Phase ${id}`,
    type: 'summary',
    start: addDays(TIMELINE_EPOCH, startDay),
    duration: 14,
    open: true
  }
}

function task(
  id: number,
  overrides: Partial<GanttTask> = {}
): GanttTask {
  return {
    id,
    text: `Task ${id}`,
    type: 'task',
    start: addDays(TIMELINE_EPOCH, 3),
    duration: 3,
    ...overrides
  }
}

describe('resolveAddTaskMode', () => {
  const tasks = [phase(10), task(11, { parent: 10, start: addDays(TIMELINE_EPOCH, 2) })]

  it('defaults to child when target is a summary row', () => {
    expect(resolveAddTaskMode(tasks, 10)).toBe('child')
  })

  it('defaults to after when target is a regular task', () => {
    expect(resolveAddTaskMode(tasks, 11)).toBe('after')
  })

  it('uses after for new phase rows', () => {
    expect(resolveAddTaskMode(tasks, 10, undefined, 'summary')).toBe('after')
  })

  it('honors explicit mode from AddRowCell', () => {
    expect(resolveAddTaskMode(tasks, 10, 'after')).toBe('after')
  })
})

describe('buildAddTaskInterceptPatch', () => {
  const tasks = [phase(10), task(11, { parent: 10, start: addDays(TIMELINE_EPOCH, 2) })]

  it('creates a child task under a phase with a new id', () => {
    const patch = buildAddTaskInterceptPatch(tasks, {
      target: 10,
      mode: 'child',
      task: { type: 'task', text: 'New Task', duration: 3 }
    })
    expect(patch.mode).toBe('child')
    expect(patch.id).toBe(12)
    expect(patch.task.type).toBe('task')
    expect(patch.task.text).toBe('New Task')
    expect(patch.task.start.getTime()).toBeGreaterThan(tasks[1].start.getTime())
  })

  it('creates a sibling phase after the current summary', () => {
    const patch = buildAddTaskInterceptPatch(tasks, {
      target: 10,
      mode: 'after',
      task: { type: 'summary', text: 'New Phase', duration: 14, open: true }
    })
    expect(patch.mode).toBe('after')
    expect(patch.task.type).toBe('summary')
    expect(patch.task.open).toBe(true)
  })
})

describe('grid add and reparent integration', () => {
  it('detects reparent between phases', () => {
    const before = [phase(1), task(2, { parent: 1 }), phase(3), task(4, { parent: 3 })]
    const after = reparentTask(before, 2, 3)
    expect(tasksChanged(before, after)).toBe(true)
    expect(after.find((t) => t.id === 2)?.parent).toBe(3)
  })

  it('keeps FS scheduling stable after reparent-only grid edit', () => {
    const links = [{ id: 1, source: 2, target: 4, type: 'e2s' as const, lag: 0 }]
    const before = [
      phase(1),
      task(2, { parent: 1, start: addDays(TIMELINE_EPOCH, 0), duration: 5 }),
      phase(3),
      task(4, { parent: 3, start: addDays(TIMELINE_EPOCH, 8), duration: 3 })
    ]
    const reparented = reparentTask(before, 2, 3)
    const moved = reparented.map((t) =>
      String(t.id) === '2' ? { ...t, start: addDays(TIMELINE_EPOCH, 0) } : t
    )

    const { scheduledTasks } = scheduleFromSerializedTasks({
      prevTasks: before,
      nextTasks: moved,
      links,
      movedId: 2,
      barMove: true
    })

    const successor = scheduledTasks.find((t) => t.id === 4)
    expect(successor).toBeDefined()
    expect(successor!.start.getTime()).toBeGreaterThanOrEqual(addDays(TIMELINE_EPOCH, 5).getTime())
  })

  it('detects add-row expansion in task list', () => {
    const before = [phase(1), task(2, { parent: 1 })]
    const patch = buildAddTaskInterceptPatch(before, {
      target: 1,
      mode: 'child',
      task: { type: 'task' }
    })
    const after = [...before, patch.task]
    expect(tasksChanged(before, after)).toBe(true)
    expect(after).toHaveLength(3)
  })
})
