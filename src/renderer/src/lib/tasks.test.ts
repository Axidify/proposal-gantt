import { addDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import type { GanttTask } from '../types'
import { TIMELINE_EPOCH } from './timeline'
import {
  defaultNewTaskStart,
  milestoneTogglePatch,
  normalizeMilestoneTaskPatch,
  tasksChanged
} from './tasks'

function task(
  id: number,
  overrides: Partial<GanttTask> = {}
): GanttTask {
  return {
    id,
    text: `Task ${id}`,
    type: 'task',
    start: TIMELINE_EPOCH,
    duration: 3,
    ...overrides
  }
}

describe('tasksChanged', () => {
  it('returns false when tasks are identical', () => {
    const tasks = [task(1), task(2, { start: addDays(TIMELINE_EPOCH, 5) })]
    expect(tasksChanged(tasks, structuredClone(tasks))).toBe(false)
  })

  it('detects text, parent, duration, and start changes', () => {
    const prev = [
      task(1),
      task(2, { parent: 10, start: addDays(TIMELINE_EPOCH, 3) })
    ]
    expect(tasksChanged(prev, [{ ...prev[0], text: 'Renamed' }, prev[1]])).toBe(true)
    expect(tasksChanged(prev, [prev[0], { ...prev[1], parent: 11 }])).toBe(true)
    expect(tasksChanged(prev, [prev[0], { ...prev[1], duration: 7 }])).toBe(true)
    expect(tasksChanged(prev, [prev[0], { ...prev[1], start: addDays(TIMELINE_EPOCH, 9) }])).toBe(
      true
    )
  })

  it('detects add and remove', () => {
    const prev = [task(1)]
    expect(tasksChanged(prev, [...prev, task(2)])).toBe(true)
    expect(tasksChanged([...prev, task(2)], prev)).toBe(true)
  })
})

describe('milestoneTogglePatch', () => {
  it('converts task to milestone with zero duration', () => {
    const patch = milestoneTogglePatch(
      { start: addDays(TIMELINE_EPOCH, 2), duration: 5, type: 'task' },
      true
    )
    expect(patch.type).toBe('milestone')
    expect(patch.duration).toBe(0)
    expect(patch.end?.getTime()).toBe(addDays(TIMELINE_EPOCH, 2).getTime())
  })

  it('restores default duration when demoting milestone', () => {
    const patch = milestoneTogglePatch(
      { start: TIMELINE_EPOCH, duration: 0, type: 'milestone' },
      false
    )
    expect(patch.type).toBe('task')
    expect(patch.duration).toBe(3)
  })
})

describe('normalizeMilestoneTaskPatch', () => {
  it('forces milestone fields on type change', () => {
    const tasks = [task(1)]
    const patch = normalizeMilestoneTaskPatch(1, { type: 'milestone' }, tasks)
    expect(patch.duration).toBe(0)
    expect(patch.progress).toBe(0)
  })

  it('restores duration when converting milestone back to task', () => {
    const tasks = [task(1, { type: 'milestone', duration: 0 })]
    const patch = normalizeMilestoneTaskPatch(1, { type: 'task' }, tasks)
    expect(patch.duration).toBe(3)
  })
})

describe('defaultNewTaskStart', () => {
  const phase = task(10, { type: 'summary', text: 'Phase', duration: 14 })
  const child = task(11, { parent: 10, start: addDays(TIMELINE_EPOCH, 5), duration: 3 })
  const sibling = task(12, { parent: 10, start: addDays(TIMELINE_EPOCH, 10), duration: 2 })

  it('places child after latest sibling under parent', () => {
    const tasks = [phase, child, sibling]
    const start = defaultNewTaskStart(tasks, 10, 'child')
    expect(start.getTime()).toBe(addDays(TIMELINE_EPOCH, 12).getTime())
  })

  it('places row after target when inserting after', () => {
    const tasks = [phase, child]
    const start = defaultNewTaskStart(tasks, 11, 'after')
    expect(start.getTime()).toBe(addDays(TIMELINE_EPOCH, 8).getTime())
  })
})
