import { addDays, addHours, addMonths, differenceInCalendarDays, format } from 'date-fns'
import type { IScaleConfig, IZoomConfig } from '@svar-ui/react-gantt'
import type { GanttTask, TimelineMode, TimelineUnit, TimelineZoom } from '../types'
import {
  asDate,
  DAYS_PER_MONTH,
  DAYS_PER_YEAR,
  formatMonthLabel,
  formatYearLabel,
  getRelativeDays,
  TIMELINE_EPOCH
} from './timeline'

function relativeDays(date: Date | string): number {
  return getRelativeDays(date)
}

/** SVAR zoom level order: coarse (0) → fine (4). */
export const ZOOM_LEVEL_ORDER: TimelineZoom[] = ['year', 'month', 'week', 'day', 'hour']

/** Toolbar display order. */
export const ZOOM_PRESETS: TimelineZoom[] = ['hour', 'day', 'week', 'month', 'year']

export const ZOOM_PRESET_LABELS: Record<TimelineZoom, string> = {
  hour: 'Hours',
  day: 'Days',
  week: 'Weeks',
  month: 'Months',
  year: 'Years'
}

export function zoomPresetToLevel(preset: TimelineZoom): number {
  return ZOOM_LEVEL_ORDER.indexOf(preset)
}

export function levelToZoomPreset(level: number): TimelineZoom {
  return ZOOM_LEVEL_ORDER[Math.min(Math.max(level, 0), ZOOM_LEVEL_ORDER.length - 1)]
}

export function zoomPresetToTimelineUnit(preset: TimelineZoom): TimelineUnit {
  switch (preset) {
    case 'month':
      return 'month'
    case 'year':
      return 'year'
    default:
      return 'day'
  }
}

export function timelineUnitToZoomPreset(unit: TimelineUnit | undefined): TimelineZoom {
  switch (unit) {
    case 'month':
      return 'month'
    case 'year':
      return 'year'
    default:
      return 'day'
  }
}

function relativeWeekInMonthLabel(date: Date): string {
  const dayInMonth = relativeDays(date) % DAYS_PER_MONTH
  return `W${Math.floor(dayInMonth / 7) + 1}`
}

function relativeHourLabel(date: Date): string {
  return format(date, 'HH:mm')
}

function relativeScalesForZoom(preset: TimelineZoom): IScaleConfig[] {
  switch (preset) {
    case 'year':
      return [
        { unit: 'day', step: DAYS_PER_YEAR, format: (date: Date) => formatYearLabel(date) },
        {
          unit: 'day',
          step: DAYS_PER_MONTH,
          format: (date: Date) => {
            const monthInYear = (relativeDays(date) % DAYS_PER_YEAR) / DAYS_PER_MONTH
            return `M${Math.floor(monthInYear) + 1}`
          }
        }
      ]
    case 'month':
      return [
        { unit: 'day', step: DAYS_PER_MONTH, format: (date: Date) => formatMonthLabel(date) },
        { unit: 'day', step: 7, format: (date: Date) => relativeWeekInMonthLabel(date) }
      ]
    case 'week':
      return [
        { unit: 'day', step: DAYS_PER_MONTH, format: (date: Date) => formatMonthLabel(date) },
        { unit: 'day', step: 7, format: (date: Date) => `Wk ${Math.floor(relativeDays(date) / 7) + 1}` }
      ]
    case 'day':
      return [
        { unit: 'day', step: DAYS_PER_MONTH, format: (date: Date) => formatMonthLabel(date) },
        { unit: 'day', step: 1, format: (date: Date) => `${relativeDays(date) + 1}` }
      ]
    case 'hour':
      return [
        { unit: 'day', step: 1, format: (date: Date) => `Day ${relativeDays(date) + 1}` },
        { unit: 'hour', step: 6, format: (date: Date) => relativeHourLabel(date) }
      ]
  }
}

function calendarScalesForZoom(preset: TimelineZoom): IScaleConfig[] {
  switch (preset) {
    case 'year':
      return [
        { unit: 'year', step: 1, format: (date: Date) => format(date, 'yyyy') },
        { unit: 'quarter', step: 1, format: (date: Date) => `Q${Math.floor(date.getMonth() / 3) + 1}` }
      ]
    case 'month':
      return [
        { unit: 'year', step: 1, format: (date: Date) => format(date, 'yyyy') },
        { unit: 'month', step: 1, format: (date: Date) => format(date, 'MMM') }
      ]
    case 'week':
      return [
        { unit: 'month', step: 1, format: (date: Date) => format(date, 'MMM yyyy') },
        { unit: 'week', step: 1, format: (date: Date) => `W${format(date, 'w')}` }
      ]
    case 'day':
      return [
        { unit: 'month', step: 1, format: (date: Date) => format(date, 'MMM yyyy') },
        { unit: 'day', step: 1, format: (date: Date) => format(date, 'd') }
      ]
    case 'hour':
      return [
        { unit: 'day', step: 1, format: (date: Date) => format(date, 'MMM d') },
        {
          unit: 'hour',
          step: 6,
          format: (date: Date, next?: Date) =>
            next
              ? `${format(date, 'HH:mm')}–${format(next, 'HH:mm')}`
              : format(date, 'HH:mm')
        }
      ]
  }
}

function zoomLevelCellWidths(preset: TimelineZoom): { minCellWidth: number; maxCellWidth: number } {
  switch (preset) {
    case 'year':
      return { minCellWidth: 72, maxCellWidth: 320 }
    case 'month':
      return { minCellWidth: 64, maxCellWidth: 280 }
    case 'week':
      return { minCellWidth: 56, maxCellWidth: 240 }
    case 'day':
      return { minCellWidth: 36, maxCellWidth: 180 }
    case 'hour':
      return { minCellWidth: 28, maxCellWidth: 120 }
  }
}

export function buildZoomConfig(mode: TimelineMode, preset: TimelineZoom): IZoomConfig {
  const levels = ZOOM_LEVEL_ORDER.map((zoomPreset) => {
    const widths = zoomLevelCellWidths(zoomPreset)
    return {
      ...widths,
      scales: mode === 'calendar' ? calendarScalesForZoom(zoomPreset) : relativeScalesForZoom(zoomPreset)
    }
  })

  return {
    level: zoomPresetToLevel(preset),
    minCellWidth: 24,
    maxCellWidth: 360,
    levels
  }
}

export function taskDateBounds(tasks: GanttTask[]): { start: Date; end: Date } | null {
  if (!tasks.length) return null

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const task of tasks) {
    const start = asDate(task.start)
    if (Number.isNaN(start.getTime())) continue

    let end = task.end ? asDate(task.end) : start
    if (task.duration != null && task.duration > 0) {
      const durationEnd = addDays(start, task.duration)
      if (durationEnd.getTime() > end.getTime()) end = durationEnd
    }
    if (task.type === 'milestone') end = start

    min = Math.min(min, start.getTime())
    max = Math.max(max, end.getTime())
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return { start: new Date(min), end: new Date(max) }
}

export function padChartRange(
  bounds: { start: Date; end: Date },
  preset: TimelineZoom
): { start: Date; end: Date } {
  const spanDays = Math.max(1, differenceInCalendarDays(bounds.end, bounds.start))
  const padDays = Math.max(3, Math.ceil(spanDays * 0.1))

  let start = addDays(bounds.start, -padDays)
  let end = addDays(bounds.end, padDays)

  if (preset === 'hour') {
    start = addHours(start, -12)
    end = addHours(end, 12)
  } else if (preset === 'year') {
    start = addMonths(start, -1)
    end = addMonths(end, 1)
  }

  return { start, end }
}

export function suggestZoomPreset(bounds: { start: Date; end: Date }): TimelineZoom {
  const days = Math.max(1, differenceInCalendarDays(bounds.end, bounds.start))
  if (days <= 3) return 'hour'
  if (days <= 28) return 'day'
  if (days <= 120) return 'week'
  if (days <= 540) return 'month'
  return 'year'
}

export function defaultChartRange(
  tasks: GanttTask[],
  mode: TimelineMode,
  projectStartDate: string
): { start: Date; end: Date } {
  const anchor = mode === 'calendar' && projectStartDate ? new Date(projectStartDate) : TIMELINE_EPOCH
  const bounds = taskDateBounds(tasks)
  if (!bounds) {
    return { start: anchor, end: addMonths(anchor, 3) }
  }
  const preset = suggestZoomPreset(bounds)
  return padChartRange(bounds, preset)
}

export function autofitChart(
  tasks: GanttTask[]
): { range: { start: Date; end: Date }; preset: TimelineZoom } {
  const bounds = taskDateBounds(tasks)
  if (!bounds) {
    return {
      range: { start: TIMELINE_EPOCH, end: addMonths(TIMELINE_EPOCH, 3) },
      preset: 'month'
    }
  }
  const preset = suggestZoomPreset(bounds)
  return { range: padChartRange(bounds, preset), preset }
}
