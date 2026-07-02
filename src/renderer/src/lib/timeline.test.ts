import { addDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import type { GanttTask } from '../types'
import {
  asDate,
  fromCalendarTasks,
  normalizeTasks,
  relativeStartEditValue,
  relativeStartFromEditValue,
  TIMELINE_EPOCH,
  toCalendarTasks
} from './timeline'

function task(startDay: number, duration = 3): GanttTask {
  return {
    id: 1,
    text: 'Task',
    type: 'task',
    start: addDays(TIMELINE_EPOCH, startDay),
    duration
  }
}

describe('asDate', () => {
  it('passes through Date instances', () => {
    const d = new Date(2025, 5, 1)
    expect(asDate(d)).toBe(d)
  })

  it('parses ISO strings', () => {
    expect(asDate('2025-06-01').getFullYear()).toBe(2025)
  })
})

describe('relative start edit helpers', () => {
  it('round-trips day-based values', () => {
    const start = addDays(TIMELINE_EPOCH, 9)
    const edited = relativeStartEditValue(start, 'day')
    expect(relativeStartFromEditValue(edited, 'day').getTime()).toBe(start.getTime())
  })

  it('round-trips month-based values', () => {
    const start = addDays(TIMELINE_EPOCH, 60)
    const edited = relativeStartEditValue(start, 'month')
    expect(relativeStartFromEditValue(edited, 'month').getTime()).toBe(start.getTime())
  })
})

describe('calendar conversion', () => {
  const projectStart = '2025-03-03'

  it('round-trips tasks through calendar mode', () => {
    const relative = [task(0, 5), task(7, 3)]
    const calendar = toCalendarTasks(relative, projectStart)
    const back = fromCalendarTasks(calendar, projectStart)
    expect(back[0].start.getTime()).toBe(relative[0].start.getTime())
    expect(back[1].start.getTime()).toBe(relative[1].start.getTime())
  })
})

describe('normalizeTasks', () => {
  it('shifts tasks so the earliest start is day 0', () => {
    const shifted = normalizeTasks([task(5), task(12)])
    expect(shifted[0].start.getTime()).toBe(TIMELINE_EPOCH.getTime())
    expect(shifted[1].start.getTime()).toBe(addDays(TIMELINE_EPOCH, 7).getTime())
  })
})
