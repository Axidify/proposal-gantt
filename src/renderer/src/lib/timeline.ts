import { addDays, addWeeks, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns'
import type { GanttTask } from '../types'
import type { TimelineMode, TimelineUnit, TimelineZoom } from '../types'
import { ZOOM_PRESET_LABELS } from './ganttZoom'

/** Fixed anchor — Day 1 in relative mode. */
export const TIMELINE_EPOCH = new Date(2024, 0, 1)

export const DAYS_PER_MONTH = 30
export const DAYS_PER_YEAR = 360

export function defaultProjectStartDate(): string {
  const nextMonday = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 })
  return format(nextMonday, 'yyyy-MM-dd')
}

export function asDate(value: Date | string | undefined | null): Date {
  if (value instanceof Date) return value
  if (value == null) return new Date(NaN)
  return new Date(value)
}

export function isValidDate(value: Date | string | undefined | null): boolean {
  return !Number.isNaN(asDate(value).getTime())
}

export function offsetDay(days: number): Date {
  return addDays(TIMELINE_EPOCH, days)
}

export function dayOffset(date: Date | string): number {
  const d = asDate(date)
  if (Number.isNaN(d.getTime())) return 0
  return differenceInCalendarDays(d, TIMELINE_EPOCH)
}

function relativeDays(date: Date | string): number {
  return Math.max(0, dayOffset(date))
}

export function getRelativeDays(date: Date | string): number {
  return relativeDays(date)
}

/** Numeric value shown when inline-editing start in relative mode. */
export function relativeStartEditValue(date: Date | string | undefined, unit: TimelineUnit): string {
  if (!isValidDate(date)) return '1'
  const days = relativeDays(date)
  switch (unit) {
    case 'month':
      return String(Math.floor(days / DAYS_PER_MONTH) + 1)
    case 'year':
      return String(Math.floor(days / DAYS_PER_YEAR) + 1)
    default:
      return String(days + 1)
  }
}

/** Convert inline-edited relative start back to an epoch-based date. */
export function relativeStartFromEditValue(value: string | number, unit: TimelineUnit): Date {
  const parsed = Number.parseInt(String(value).trim(), 10)
  const index = Number.isFinite(parsed) ? Math.max(1, parsed) : 1
  switch (unit) {
    case 'month':
      return offsetDay((index - 1) * DAYS_PER_MONTH)
    case 'year':
      return offsetDay((index - 1) * DAYS_PER_YEAR)
    default:
      return offsetDay(index - 1)
  }
}

function durationEditable(type?: string): boolean {
  return type !== 'milestone' && type !== 'summary'
}

export function normalizeTasks(tasks: GanttTask[]): GanttTask[] {
  if (!tasks.length) return tasks

  const revived = tasks.map(reviveDates)
  const offsets = revived.map((t) => dayOffset(t.start))
  const minOffset = Math.min(...offsets)
  if (minOffset === 0) return revived

  return revived.map((t) => {
    const start = addDays(asDate(t.start), -minOffset)
    const end = t.end ? addDays(asDate(t.end), -minOffset) : undefined
    return { ...t, start, end }
  })
}

function reviveDates(task: GanttTask): GanttTask {
  return {
    ...task,
    start: asDate(task.start),
    end: task.end ? asDate(task.end) : undefined
  }
}

export function toCalendarTasks(tasks: GanttTask[], projectStart: string): GanttTask[] {
  const anchor = parseISO(projectStart)
  return tasks.map((task) => {
    const offset = dayOffset(task.start)
    const start = addDays(anchor, offset)
    const end = task.end
      ? addDays(anchor, differenceInCalendarDays(asDate(task.end), TIMELINE_EPOCH))
      : task.duration != null
        ? addDays(start, task.duration)
        : undefined
    return { ...task, start, end }
  })
}

export function fromCalendarTasks(tasks: GanttTask[], projectStart: string): GanttTask[] {
  const anchor = parseISO(projectStart)
  return tasks.map((task) => {
    const offset = differenceInCalendarDays(asDate(task.start), anchor)
    const start = addDays(TIMELINE_EPOCH, offset)
    let end: Date | undefined
    if (task.end) {
      end = addDays(TIMELINE_EPOCH, differenceInCalendarDays(asDate(task.end), anchor))
    }
    return { ...task, start, end }
  })
}

export function formatDayLabel(date: Date | string): string {
  if (!isValidDate(date)) return '—'
  return `Day ${relativeDays(date) + 1}`
}

export function formatMonthLabel(date: Date | string): string {
  if (!isValidDate(date)) return '—'
  const days = relativeDays(date)
  return `Month ${Math.floor(days / DAYS_PER_MONTH) + 1}`
}

export function formatYearLabel(date: Date | string): string {
  if (!isValidDate(date)) return '—'
  const days = relativeDays(date)
  return `Year ${Math.floor(days / DAYS_PER_YEAR) + 1}`
}

export function formatRelativeStart(date: Date | string, unit: TimelineUnit): string {
  switch (unit) {
    case 'month':
      return formatMonthLabel(date)
    case 'year':
      return formatYearLabel(date)
    default:
      return formatDayLabel(date)
  }
}

export function formatCalendarStart(date: Date | string): string {
  if (!isValidDate(date)) return '—'
  return format(asDate(date), 'MMM d, yyyy')
}

export function formatRelativeDuration(days: number | undefined, unit: TimelineUnit): string {
  const d = days ?? 0
  if (d === 0) return '—'
  switch (unit) {
    case 'month': {
      const months = d / DAYS_PER_MONTH
      return months >= 1 && Number.isInteger(months) ? `${months} mo` : `~${months.toFixed(1)} mo`
    }
    case 'year': {
      const years = d / DAYS_PER_YEAR
      return `~${years.toFixed(1)} yr`
    }
    default:
      return `${d}d`
  }
}

export function timelineUnitLabel(unit: TimelineUnit): string {
  switch (unit) {
    case 'month':
      return 'Months'
    case 'year':
      return 'Years'
    default:
      return 'Days'
  }
}

export function timelineModeLabel(
  mode: TimelineMode,
  unit: TimelineUnit,
  projectStart?: string,
  zoom?: TimelineZoom
): string {
  const zoomLabel = zoom ? ZOOM_PRESET_LABELS[zoom] : timelineUnitLabel(unit)
  if (mode === 'calendar' && projectStart) {
    return `Starting ${format(parseISO(projectStart), 'MMM d, yyyy')} · ${zoomLabel}`
  }
  return `Relative timeline · ${zoomLabel}`
}

function relativeWeekInMonthLabel(date: Date): string {
  const dayInMonth = relativeDays(date) % DAYS_PER_MONTH
  return `W${Math.floor(dayInMonth / 7) + 1}`
}

/** Day-based scale steps so columns align with TIMELINE_EPOCH (not calendar month/week). */
function relativeScales(unit: TimelineUnit) {
  switch (unit) {
    case 'month':
      return [
        { unit: 'day' as const, step: DAYS_PER_MONTH, format: (date: Date) => formatMonthLabel(date) },
        { unit: 'day' as const, step: 7, format: (date: Date) => relativeWeekInMonthLabel(date) }
      ]
    case 'year':
      return [
        { unit: 'day' as const, step: DAYS_PER_YEAR, format: (date: Date) => formatYearLabel(date) },
        {
          unit: 'day' as const,
          step: DAYS_PER_MONTH,
          format: (date: Date) => {
            const monthInYear = (relativeDays(date) % DAYS_PER_YEAR) / DAYS_PER_MONTH
            return `M${Math.floor(monthInYear) + 1}`
          }
        }
      ]
    default:
      return [
        { unit: 'day' as const, step: DAYS_PER_MONTH, format: (date: Date) => formatMonthLabel(date) },
        {
          unit: 'day' as const,
          step: 7,
          format: (date: Date) => `Wk ${Math.floor(relativeDays(date) / 7) + 1}`
        },
        { unit: 'day' as const, step: 1, format: (date: Date) => `${relativeDays(date) + 1}` }
      ]
  }
}

function calendarScales(unit: TimelineUnit) {
  switch (unit) {
    case 'month':
      return [
        { unit: 'month' as const, step: 1, format: (date: Date) => format(date, 'MMMM yyyy') },
        { unit: 'week' as const, step: 1, format: (date: Date) => format(date, 'MMM d') }
      ]
    case 'year':
      return [
        { unit: 'year' as const, step: 1, format: (date: Date) => format(date, 'yyyy') },
        { unit: 'month' as const, step: 1, format: (date: Date) => format(date, 'MMM') }
      ]
    default:
      return [
        { unit: 'month' as const, step: 1, format: (date: Date) => format(date, 'MMMM yyyy') },
        { unit: 'week' as const, step: 1, format: (date: Date) => format(date, 'MMM d') },
        { unit: 'day' as const, step: 1, format: (date: Date) => format(date, 'd') }
      ]
  }
}

export function getTimelineScales(unit: TimelineUnit, mode: TimelineMode) {
  return mode === 'calendar' ? calendarScales(unit) : relativeScales(unit)
}

export function getTimelineColumns(unit: TimelineUnit, mode: TimelineMode) {
  const durationHeader = unit === 'day' ? 'Days' : 'Duration'

  const startColumn =
    mode === 'calendar'
      ? {
          id: 'start',
          header: 'Start date',
          width: 120,
          align: 'center' as const,
          template: (value: Date | string) => formatCalendarStart(value),
          editor: 'datepicker' as const
        }
      : {
          id: 'start',
          header: 'Start',
          width: 90,
          align: 'center' as const,
          template: (value: Date | string) => formatRelativeStart(value, unit),
          getter: (row: { start?: Date | string }) => relativeStartEditValue(row.start, unit),
          setter: (row: { start?: Date | string }, value: string | number) => {
            row.start = relativeStartFromEditValue(value, unit)
          },
          editor: 'text' as const
        }

  return [
    {
      id: 'text',
      header: 'Task',
      flexgrow: 2,
      editor: 'text' as const,
      setter: (row: { text?: string }, value: string | number) => {
        const trimmed = String(value).trim()
        row.text = trimmed || 'Untitled'
      }
    },
    startColumn,
    {
      id: 'duration',
      header: durationHeader,
      width: 80,
      align: 'center' as const,
      template: (value: number) => formatRelativeDuration(value, unit),
      setter: (row: { duration?: number }, value: string | number) => {
        const parsed = Number.parseInt(String(value).trim(), 10)
        row.duration = Number.isFinite(parsed) ? Math.max(1, parsed) : 1
      },
      editor: (row: { type?: string }) => (durationEditable(row.type) ? 'text' : null)
    }
  ]
}
