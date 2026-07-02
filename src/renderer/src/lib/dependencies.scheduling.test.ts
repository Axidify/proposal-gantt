import { addDays, differenceInCalendarDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { applyFsScheduling, getFsLag, getTaskEnd } from './dependencies'
import type { GanttLink, GanttTask } from '../types'
import { asDate, TIMELINE_EPOCH } from './timeline'

function task(id: number, startDay: number, dur: number): GanttTask {
  return {
    id,
    text: `Task ${id}`,
    type: 'task',
    start: addDays(TIMELINE_EPOCH, startDay),
    end: addDays(TIMELINE_EPOCH, startDay + dur),
    duration: dur
  }
}

function lagForLink(tasks: GanttTask[], links: GanttLink[], source: number, target: number): number {
  const link = links.find((l) => l.source === source && l.target === target)!
  return getFsLag(link, tasks)
}

function startDay(t: GanttTask): number {
  return differenceInCalendarDays(asDate(t.start), TIMELINE_EPOCH)
}

const links: GanttLink[] = [{ id: 1, source: 1, target: 2, type: 'e2s', lag: 2 }]
const chainLinks: GanttLink[] = [
  { id: 1, source: 1, target: 2, type: 'e2s', lag: 2 },
  { id: 2, source: 2, target: 3, type: 'e2s', lag: 1 }
]

describe('applyFsScheduling', () => {
  it('forward drag maintains lag', () => {
    const prev = [task(1, 0, 5), task(2, 7, 3)]
    const next = [task(1, 5, 5), task(2, 7, 3)]
    const { tasks } = applyFsScheduling(prev, next, links, 1)
    expect(lagForLink(tasks, links, 1, 2)).toBe(2)
    expect(startDay(tasks[1])).toBe(12)
  })

  it('backward drag with correct end maintains lag', () => {
    const prev = [task(1, 0, 5), task(2, 7, 3)]
    const next = [task(1, -3, 5), task(2, 7, 3)]
    const { tasks } = applyFsScheduling(prev, next, links, 1)
    expect(lagForLink(tasks, links, 1, 2)).toBe(2)
    expect(startDay(tasks[1])).toBe(4)
  })

  it('backward drag with stale end maintains lag (regression)', () => {
    const prev = [task(1, 0, 5), task(2, 7, 3)]
    const staleMoved = { ...task(1, -3, 5), end: addDays(TIMELINE_EPOCH, 5) }
    const next = [staleMoved, task(2, 7, 3)]
    const { tasks } = applyFsScheduling(prev, next, links, 1)
    expect(lagForLink(tasks, links, 1, 2)).toBe(2)
    expect(startDay(tasks[1])).toBe(4)
  })

  it('forward drag with stale end maintains lag', () => {
    const prev = [task(1, 0, 5), task(2, 7, 3)]
    const staleMoved = { ...task(1, 5, 5), end: addDays(TIMELINE_EPOCH, 5) }
    const next = [staleMoved, task(2, 7, 3)]
    const { tasks } = applyFsScheduling(prev, next, links, 1)
    expect(lagForLink(tasks, links, 1, 2)).toBe(2)
    expect(startDay(tasks[1])).toBe(12)
  })

  it('backward chain drag cascades all successors', () => {
    const prev = [task(1, 0, 5), task(2, 7, 4), task(3, 12, 3)]
    const next = [task(1, -4, 5), task(2, 7, 4), task(3, 12, 3)]
    const { tasks } = applyFsScheduling(prev, next, chainLinks, 1)
    expect(lagForLink(tasks, chainLinks, 1, 2)).toBe(2)
    expect(lagForLink(tasks, chainLinks, 2, 3)).toBe(1)
    expect(startDay(tasks[1])).toBe(3)
    expect(startDay(tasks[2])).toBe(8)
  })

  it('backward drag with pinned finish (bar move) maintains lag', () => {
    const prev = [task(1, 0, 5), task(2, 7, 3)]
    const pinnedFinish = { ...task(1, -5, 10), end: addDays(TIMELINE_EPOCH, 5) }
    const next = [pinnedFinish, task(2, 7, 3)]
    const { tasks } = applyFsScheduling(prev, next, links, 1, { barMove: true })
    expect(lagForLink(tasks, links, 1, 2)).toBe(2)
    expect(startDay(tasks[1])).toBe(2)
  })

  it('left-edge resize does not shift successors', () => {
    const prev = [task(1, 5, 5), task(2, 12, 3)]
    const resized = { ...task(1, 0, 10), end: addDays(TIMELINE_EPOCH, 10) }
    const next = [resized, task(2, 12, 3)]
    const { tasks } = applyFsScheduling(prev, next, links, 1, { barMove: false })
    expect(startDay(tasks[1])).toBe(12)
    expect(lagForLink(tasks, links, 1, 2)).toBe(2)
  })

  it('backward drag preserves slack on successor', () => {
    const slackLinks: GanttLink[] = [{ id: 1, source: 1, target: 2, type: 'e2s', lag: 2 }]
    const prev = [task(1, 0, 5), task(2, 10, 3)]
    const next = [task(1, -3, 5), task(2, 10, 3)]
    const { tasks } = applyFsScheduling(prev, next, slackLinks, 1)
    expect(lagForLink(tasks, slackLinks, 1, 2)).toBe(2)
    expect(startDay(tasks[1])).toBe(7)
  })
})

describe('getTaskEnd', () => {
  it('uses explicit end when present', () => {
    const t = task(1, 0, 5)
    expect(getTaskEnd(t).getTime()).toBe(asDate(t.end!).getTime())
  })

  it('derives end from start + duration', () => {
    const t: GanttTask = {
      id: 1,
      text: 'x',
      type: 'task',
      start: TIMELINE_EPOCH,
      duration: 4
    }
    expect(differenceInCalendarDays(getTaskEnd(t), TIMELINE_EPOCH)).toBe(4)
  })
})
