import assert from 'node:assert/strict'
import { addDays, differenceInCalendarDays } from 'date-fns'
import { applyFsScheduling, getFsLag, getTaskEnd } from '../src/renderer/src/lib/dependencies'
import type { GanttLink, GanttTask } from '../src/renderer/src/types'
import { asDate } from '../src/renderer/src/lib/timeline'

const EPOCH = new Date(2024, 0, 1)

function task(id: number, startDay: number, dur: number): GanttTask {
  return {
    id,
    text: `Task ${id}`,
    type: 'task',
    start: addDays(EPOCH, startDay),
    end: addDays(EPOCH, startDay + dur),
    duration: dur
  }
}

function lagForLink(tasks: GanttTask[], links: GanttLink[], source: number, target: number): number {
  const link = links.find((l) => l.source === source && l.target === target)!
  return getFsLag(link, tasks)
}

function startDay(t: GanttTask): number {
  return differenceInCalendarDays(asDate(t.start), EPOCH)
}

function runCase(name: string, fn: () => void): void {
  fn()
  console.log(`  ✓ ${name}`)
}

const links: GanttLink[] = [{ id: 1, source: 1, target: 2, type: 'e2s', lag: 2 }]
const chainLinks: GanttLink[] = [
  { id: 1, source: 1, target: 2, type: 'e2s', lag: 2 },
  { id: 2, source: 2, target: 3, type: 'e2s', lag: 1 }
]

console.log('applyFsScheduling verification\n')

runCase('forward drag maintains lag', () => {
  const prev = [task(1, 0, 5), task(2, 7, 3)]
  const next = [task(1, 5, 5), task(2, 7, 3)]
  const { tasks } = applyFsScheduling(prev, next, links, 1)
  assert.equal(lagForLink(tasks, links, 1, 2), 2)
  assert.equal(startDay(tasks[1]), 12)
})

runCase('backward drag with correct end maintains lag', () => {
  const prev = [task(1, 0, 5), task(2, 7, 3)]
  const next = [task(1, -3, 5), task(2, 7, 3)]
  const { tasks } = applyFsScheduling(prev, next, links, 1)
  assert.equal(lagForLink(tasks, links, 1, 2), 2)
  assert.equal(startDay(tasks[1]), 4)
})

runCase('backward drag with stale end maintains lag (regression)', () => {
  const prev = [task(1, 0, 5), task(2, 7, 3)]
  const staleMoved = { ...task(1, -3, 5), end: addDays(EPOCH, 5) }
  const next = [staleMoved, task(2, 7, 3)]
  const { tasks } = applyFsScheduling(prev, next, links, 1)
  assert.equal(lagForLink(tasks, links, 1, 2), 2)
  assert.equal(startDay(tasks[1]), 4)
})

runCase('forward drag with stale end maintains lag', () => {
  const prev = [task(1, 0, 5), task(2, 7, 3)]
  const staleMoved = { ...task(1, 5, 5), end: addDays(EPOCH, 5) }
  const next = [staleMoved, task(2, 7, 3)]
  const { tasks } = applyFsScheduling(prev, next, links, 1)
  assert.equal(lagForLink(tasks, links, 1, 2), 2)
  assert.equal(startDay(tasks[1]), 12)
})

runCase('backward chain drag cascades all successors', () => {
  const prev = [task(1, 0, 5), task(2, 7, 4), task(3, 12, 3)]
  const next = [task(1, -4, 5), task(2, 7, 4), task(3, 12, 3)]
  const { tasks } = applyFsScheduling(prev, next, chainLinks, 1)
  assert.equal(lagForLink(tasks, chainLinks, 1, 2), 2)
  assert.equal(lagForLink(tasks, chainLinks, 2, 3), 1)
  assert.equal(startDay(tasks[1]), 3)
  assert.equal(startDay(tasks[2]), 8)
})

runCase('backward drag with pinned finish (bar move) maintains lag', () => {
  const prev = [task(1, 0, 5), task(2, 7, 3)]
  const pinnedFinish = { ...task(1, -5, 10), end: addDays(EPOCH, 5) }
  const next = [pinnedFinish, task(2, 7, 3)]
  const { tasks } = applyFsScheduling(prev, next, links, 1, { barMove: true })
  assert.equal(lagForLink(tasks, links, 1, 2), 2)
  assert.equal(startDay(tasks[1]), 2)
})

runCase('left-edge resize does not shift successors', () => {
  const prev = [task(1, 5, 5), task(2, 12, 3)]
  const resized = { ...task(1, 0, 10), end: addDays(EPOCH, 10) }
  const next = [resized, task(2, 12, 3)]
  const { tasks } = applyFsScheduling(prev, next, links, 1, { barMove: false })
  assert.equal(startDay(tasks[1]), 12)
  assert.equal(lagForLink(tasks, links, 1, 2), 2)
})

runCase('backward drag preserves slack on successor', () => {
  const slackLinks: GanttLink[] = [{ id: 1, source: 1, target: 2, type: 'e2s', lag: 2 }]
  const prev = [task(1, 0, 5), task(2, 10, 3)]
  const next = [task(1, -3, 5), task(2, 10, 3)]
  const { tasks } = applyFsScheduling(prev, next, slackLinks, 1)
  assert.equal(lagForLink(tasks, slackLinks, 1, 2), 2)
  assert.equal(startDay(tasks[1]), 7)
})

console.log('\nAll 8 cases passed.')
