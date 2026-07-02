import { addDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import type { GanttTask } from '../types'
import { TIMELINE_EPOCH } from '../timeline'
import { applyAddTaskRequest, applyMilestoneToggle, deleteTaskSubtree, insertTaskIntoTree } from './taskMutations'

function task(id: number, overrides: Partial<GanttTask> = {}): GanttTask {
  return {
    id,
    text: `Task ${id}`,
    type: 'task',
    start: TIMELINE_EPOCH,
    duration: 3,
    ...overrides
  }
}

describe('insertTaskIntoTree', () => {
  const phase = task(10, { type: 'summary', text: 'Phase', duration: 14, open: true })
  const child = task(11, { parent: 10, start: addDays(TIMELINE_EPOCH, 2) })

  it('inserts child after siblings under a phase', () => {
    const newTask = task(12, { text: 'New Task', parent: 10 })
    const next = insertTaskIntoTree([phase, child], 10, 'child', newTask)
    expect(next).toHaveLength(3)
    expect(next[2].text).toBe('New Task')
    expect(next[2].parent).toBe(10)
  })

  it('inserts after a sibling task', () => {
    const newTask = task(12, { text: 'After', parent: 10 })
    const next = insertTaskIntoTree([phase, child], 11, 'after', newTask)
    expect(next.map((t) => t.id)).toEqual([10, 11, 12])
  })
})

describe('applyMilestoneToggle', () => {
  it('converts a task to milestone with zero duration', () => {
    const tasks = [task(1, { duration: 5, start: addDays(TIMELINE_EPOCH, 2) })]
    const next = applyMilestoneToggle(tasks, 1, true)
    expect(next[0].type).toBe('milestone')
    expect(next[0].duration).toBe(0)
    expect(next[0].end?.getTime()).toBe(addDays(TIMELINE_EPOCH, 2).getTime())
  })
})

describe('applyAddTaskRequest', () => {
  it('adds a named task under a summary row', () => {
    const phase = task(1, { type: 'summary', duration: 14, open: true })
    const next = applyAddTaskRequest([phase], {
      target: 1,
      mode: 'child',
      task: { type: 'task', text: 'New Task', duration: 3 }
    })
    expect(next).toHaveLength(2)
    expect(next[1].text).toBe('New Task')
    expect(next[1].parent).toBe(1)
  })
})

describe('deleteTaskSubtree', () => {
  it('removes a task and its descendants plus related links', () => {
    const phase = task(1, { type: 'summary', duration: 14, open: true })
    const child = task(2, { parent: 1 })
    const other = task(3)
    const links = [
      { id: 1, source: 2, target: 3, type: 'e2s' as const, lag: 0 },
      { id: 2, source: 3, target: 2, type: 'e2s' as const, lag: 0 }
    ]
    const result = deleteTaskSubtree([phase, child, other], links, 1)
    expect(result.tasks.map((t) => t.id)).toEqual([3])
    expect(result.links).toHaveLength(0)
  })
})
