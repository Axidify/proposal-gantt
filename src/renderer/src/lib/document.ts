import { differenceInCalendarDays } from 'date-fns'
import type { GanttLink, GanttTask, ProposalDocument, TimelineMode, TimelineUnit, TimelineZoom } from '../types'
import { getTaskEnd, reconcileAllFsConstraints } from './dependencies'
import { asDate, defaultProjectStartDate, normalizeTasks } from './timeline'
import { timelineUnitToZoomPreset, zoomPresetToTimelineUnit } from './ganttZoom'

export function serializeDocument(doc: ProposalDocument): string {
  return JSON.stringify(doc, null, 2)
}

export function parseDocument(raw: string): ProposalDocument {
  const parsed = JSON.parse(raw) as ProposalDocument
  if (!parsed.version || !parsed.meta || !parsed.tasks) {
    throw new Error('Invalid proposal file format')
  }
  return reviveDocument(parsed)
}

function reviveTask(task: GanttTask): GanttTask {
  return {
    ...task,
    start: asDate(task.start),
    end: task.end != null ? asDate(task.end) : undefined
  }
}

function inferLinkLag(link: GanttLink, tasks: GanttTask[]): number | undefined {
  if (link.lag !== undefined && link.lag !== null) return link.lag
  if (link.type !== 'e2s') return undefined
  const source = tasks.find((t) => String(t.id) === String(link.source))
  const target = tasks.find((t) => String(t.id) === String(link.target))
  if (!source || !target) return undefined
  return Math.max(0, differenceInCalendarDays(asDate(target.start), getTaskEnd(source)))
}

export function reviveDocument(doc: ProposalDocument): ProposalDocument {
  const revivedTasks = doc.tasks.map(reviveTask)
  const links = (doc.links ?? []).map((link) => {
    const lag = inferLinkLag(link, revivedTasks)
    return lag !== undefined ? { ...link, lag } : link
  })
  const tasks = normalizeTasks(reconcileAllFsConstraints(revivedTasks, links))

  const timelineZoom =
    (doc.meta.timelineZoom as TimelineZoom | undefined) ??
    timelineUnitToZoomPreset(doc.meta.timelineUnit as TimelineUnit | undefined)

  return {
    ...doc,
    meta: {
      ...doc.meta,
      timelineUnit: zoomPresetToTimelineUnit(timelineZoom),
      timelineZoom,
      timelineMode: (doc.meta.timelineMode ?? 'relative') as TimelineMode,
      projectStartDate: doc.meta.projectStartDate ?? defaultProjectStartDate()
    },
    tasks,
    links
  }
}

export function documentTitle(doc: ProposalDocument): string {
  return doc.meta.title.trim() || 'Untitled Proposal'
}

export function nextTaskId(tasks: GanttTask[]): number {
  const ids = tasks.map((t) => Number(t.id)).filter((n) => !Number.isNaN(n))
  return ids.length ? Math.max(...ids) + 1 : 1
}

export function nextLinkId(links: GanttLink[]): number {
  const ids = links.map((l) => Number(l.id)).filter((n) => !Number.isNaN(n))
  return ids.length ? Math.max(...ids) + 1 : 1
}
