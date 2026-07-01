import { addDays, addWeeks, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns'
import type { GanttTask } from '../types'
import type { TimelineMode, TimelineUnit } from '../types'

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

export function timelineModeLabel(mode: TimelineMode, unit: TimelineUnit, projectStart?: string): string {
  if (mode === 'calendar' && projectStart) {
    return `Starting ${format(parseISO(projectStart), 'MMM d, yyyy')} · ${timelineUnitLabel(unit)}`
  }
  return `Relative timeline · ${timelineUnitLabel(unit)}`
}

function relativeScales(unit: TimelineUnit) {
  switch (unit) {
    case 'month':
      return [
        { unit: 'month' as const, step: 1, format: (date: Date) => formatMonthLabel(date) },
        {
          unit: 'week' as const,
          step: 1,
          format: (date: Date) => {
            const dayInMonth = (relativeDays(date) % DAYS_PER_MONTH) + 1
            return `W${Math.ceil(dayInMonth / 7)}`
          }
        }
      ]
    case 'year':
      return [
        { unit: 'year' as const, step: 1, format: (date: Date) => formatYearLabel(date) },
        {
          unit: 'month' as const,
          step: 1,
          format: (date: Date) => {
            const monthInYear = (relativeDays(date) % DAYS_PER_YEAR) / DAYS_PER_MONTH
            return `M${Math.floor(monthInYear) + 1}`
          }
        }
      ]
    default:
      return [
        { unit: 'month' as const, step: 1, format: (date: Date) => formatMonthLabel(date) },
        { unit: 'week' as const, step: 1, format: (date: Date) => `Wk ${Math.floor(relativeDays(date) / 7) + 1}` },
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

  return [
    { id: 'text', header: 'Task', flexgrow: 2 },
    {
      id: 'start',
      header: mode === 'calendar' ? 'Start date' : 'Start',
      width: 110,
      template: (value: Date | string) =>
        mode === 'calendar' ? formatCalendarStart(value) : formatRelativeStart(value, unit)
    },
    {
      id: 'duration',
      header: durationHeader,
      width: 80,
      template: (value: number) => formatRelativeDuration(value, unit)
    }
  ]
}
