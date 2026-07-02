import { addDays, differenceInCalendarDays } from 'date-fns'
import type { GanttLink, GanttTask } from '../types'
import { asDate } from './timeline'
import { nextLinkId } from './document'

export const FS_LINK_TYPE = 'e2s' as const

export function coerceTaskId(id: number | string): number | string {
  if (typeof id === 'number') return id
  if (id.startsWith(':')) return id.slice(1)
  const n = Number(id)
  return Number.isNaN(n) ? id : n
}

export function linkableTasks(tasks: GanttTask[]): GanttTask[] {
  return tasks.filter((t) => t.type !== 'summary')
}

export function taskLabel(tasks: GanttTask[], id: number | string): string {
  return tasks.find((t) => String(t.id) === String(id))?.text ?? `Task ${id}`
}

export function fsLinks(links: GanttLink[]): GanttLink[] {
  return links.filter((l) => l.type === FS_LINK_TYPE)
}

export function getTaskEnd(task: GanttTask): Date {
  const start = asDate(task.start)
  if (task.end) return asDate(task.end)
  return addDays(start, task.duration ?? 0)
}

export function getFsLag(link: GanttLink, tasks: GanttTask[]): number {
  if (link.lag !== undefined && link.lag !== null) return link.lag
  const source = tasks.find((t) => String(t.id) === String(link.source))
  const target = tasks.find((t) => String(t.id) === String(link.target))
  if (!source || !target) return 0
  return differenceInCalendarDays(asDate(target.start), getTaskEnd(source))
}

export function hasFsLink(links: GanttLink[], source: number | string, target: number | string): boolean {
  return links.some(
    (l) =>
      l.type === FS_LINK_TYPE &&
      String(l.source) === String(source) &&
      String(l.target) === String(target)
  )
}

export function findFsLink(
  links: GanttLink[],
  source: number | string,
  target: number | string
): GanttLink | undefined {
  return links.find(
    (l) =>
      l.type === FS_LINK_TYPE &&
      String(l.source) === String(source) &&
      String(l.target) === String(target)
  )
}

export function wouldCreateCycle(
  links: GanttLink[],
  source: number | string,
  target: number | string
): boolean {
  if (String(source) === String(target)) return true

  const adj = new Map<string, string[]>()
  for (const link of links) {
    if (link.type !== FS_LINK_TYPE) continue
    const s = String(link.source)
    const t = String(link.target)
    const next = adj.get(s) ?? []
    next.push(t)
    adj.set(s, next)
  }

  const stack = [String(target)]
  const seen = new Set<string>()
  while (stack.length) {
    const node = stack.pop()!
    if (node === String(source)) return true
    if (seen.has(node)) continue
    seen.add(node)
    for (const next of adj.get(node) ?? []) stack.push(next)
  }
  return false
}

function setTaskStart(tasks: GanttTask[], taskId: number | string, start: Date): GanttTask[] {
  return tasks.map((task) => {
    if (String(task.id) !== String(taskId)) return task
    const duration = task.duration ?? 0
    const next: GanttTask = { ...task, start }
    if (duration > 0) next.end = addDays(start, duration)
    else if (task.type === 'milestone') next.end = start
    return next
  })
}

/** Derive end from start + duration when the chart reports a stale end after drag. */
function normalizeTaskDates(task: GanttTask): GanttTask {
  const start = asDate(task.start)
  const duration = task.duration ?? 0
  if (task.type === 'milestone' || duration === 0) {
    return { ...task, start, end: start }
  }
  return { ...task, start, end: addDays(start, duration) }
}

/** Finish pinned but start moved — restore a whole-bar move using the prior duration. */
function correctBarMoveDates(oldTask: GanttTask, currentTask: GanttTask): GanttTask {
  const start = asDate(currentTask.start)
  const duration = oldTask.duration ?? 0
  if (currentTask.type === 'milestone' || duration === 0) {
    return { ...currentTask, start, end: start, duration: 0 }
  }
  return { ...currentTask, start, end: addDays(start, duration), duration }
}

function getTransitiveSuccessorIds(links: GanttLink[], rootId: number | string): (number | string)[] {
  const result: (number | string)[] = []
  const seen = new Set<string>()
  const queue = [String(rootId)]

  while (queue.length) {
    const current = queue.shift()!
    for (const link of fsLinks(links)) {
      if (String(link.source) !== current) continue
      const targetKey = String(link.target)
      if (seen.has(targetKey)) continue
      seen.add(targetKey)
      result.push(link.target)
      queue.push(targetKey)
    }
  }

  return result
}

function shiftSuccessorAfterPredecessor(
  tasks: GanttTask[],
  sourceId: number | string,
  targetId: number | string,
  lag: number
): GanttTask[] {
  const source = tasks.find((t) => String(t.id) === String(sourceId))
  const target = tasks.find((t) => String(t.id) === String(targetId))
  if (!source || !target || target.type === 'summary') return tasks

  const requiredStart = addDays(getTaskEnd(source), lag)
  const targetStart = asDate(target.start)
  if (targetStart.getTime() === requiredStart.getTime()) return tasks
  if (targetStart > requiredStart) return tasks
  return setTaskStart(tasks, targetId, requiredStart)
}

function enforceSuccessorMinStart(
  tasks: GanttTask[],
  links: GanttLink[],
  targetId: number | string
): { tasks: GanttTask[]; clamped: boolean } {
  const inbound = fsLinks(links).filter((l) => String(l.target) === String(targetId))
  if (!inbound.length) return { tasks, clamped: false }

  let minStart: Date | null = null
  for (const link of inbound) {
    const source = tasks.find((t) => String(t.id) === String(link.source))
    if (!source) continue
    const required = addDays(getTaskEnd(source), getFsLag(link, tasks))
    if (!minStart || required > minStart) minStart = required
  }

  if (!minStart) return { tasks, clamped: false }

  const target = tasks.find((t) => String(t.id) === String(targetId))
  if (!target || target.type === 'summary') return { tasks, clamped: false }

  if (asDate(target.start) < minStart) {
    return { tasks: setTaskStart(tasks, targetId, minStart), clamped: true }
  }

  return { tasks, clamped: false }
}

function updateInboundLags(
  links: GanttLink[],
  tasks: GanttTask[],
  targetId: number | string
): GanttLink[] {
  return links.map((link) => {
    if (link.type !== FS_LINK_TYPE || String(link.target) !== String(targetId)) return link
    const source = tasks.find((t) => String(t.id) === String(link.source))
    const target = tasks.find((t) => String(t.id) === String(targetId))
    if (!source || !target) return link
    const lag = differenceInCalendarDays(asDate(target.start), getTaskEnd(source))
    return { ...link, lag }
  })
}

function cascadeSuccessorsByDays(
  tasks: GanttTask[],
  links: GanttLink[],
  sourceId: number | string,
  days: number
): GanttTask[] {
  if (days === 0) return tasks

  let result = tasks
  for (const succId of getTransitiveSuccessorIds(links, sourceId)) {
    const task = result.find((t) => String(t.id) === String(succId))
    if (!task || task.type === 'summary') continue
    result = setTaskStart(result, succId, addDays(asDate(task.start), days))
  }
  return result
}

function findMovedTaskId(prevTasks: GanttTask[], nextTasks: GanttTask[]): number | string | null {
  let best: { id: number | string; delta: number } | null = null
  for (const next of nextTasks) {
    const prev = prevTasks.find((t) => String(t.id) === String(next.id))
    if (!prev) continue
    const delta = Math.abs(differenceInCalendarDays(asDate(next.start), asDate(prev.start)))
    if (delta === 0) continue
    if (!best || delta > best.delta) best = { id: next.id, delta }
  }
  return best?.id ?? null
}

function shiftOutboundSuccessorsWithPredecessor(
  tasks: GanttTask[],
  links: GanttLink[],
  movedId: number | string,
  oldTask: GanttTask,
  allowBarMoveCorrection: boolean
): GanttTask[] {
  const normalizedOld = normalizeTaskDates(oldTask)
  let movedTask = normalizeTaskDates(tasks.find((t) => String(t.id) === String(movedId))!)

  const startDelta = differenceInCalendarDays(asDate(movedTask.start), asDate(normalizedOld.start))
  let endDelta = differenceInCalendarDays(getTaskEnd(movedTask), getTaskEnd(normalizedOld))

  if (allowBarMoveCorrection && startDelta !== 0 && endDelta === 0) {
    movedTask = correctBarMoveDates(normalizedOld, movedTask)
    endDelta = differenceInCalendarDays(getTaskEnd(movedTask), getTaskEnd(normalizedOld))
  }

  let result = tasks.map((t) => (String(t.id) === String(movedId) ? movedTask : t))
  const shiftDays =
    endDelta !== 0 ? endDelta : allowBarMoveCorrection && startDelta !== 0 ? startDelta : 0

  if (shiftDays !== 0) {
    result = cascadeSuccessorsByDays(result, links, movedId, shiftDays)
  }

  return result
}

export function reconcileAllFsConstraints(tasks: GanttTask[], links: GanttLink[]): GanttTask[] {
  const fs = fsLinks(links)
  if (!fs.length) return tasks

  let result = tasks.map((t) => ({ ...t }))
  for (let pass = 0; pass < fs.length; pass++) {
    let changed = false
    for (const link of fs) {
      const target = result.find((t) => String(t.id) === String(link.target))
      if (!target) continue
      const before = asDate(target.start).getTime()
      result = shiftSuccessorAfterPredecessor(
        result,
        link.source,
        link.target,
        getFsLag(link, result)
      )
      const after = asDate(
        result.find((t) => String(t.id) === String(link.target))!.start
      ).getTime()
      if (before !== after) changed = true
    }
    if (!changed) break
  }
  return result
}

export interface FsSchedulingOptions {
  /** True when the user dragged the bar body (not resizing from an edge). */
  barMove?: boolean
}

export function taskDatesDiffer(a: GanttTask, b: GanttTask): boolean {
  if (asDate(a.start).getTime() !== asDate(b.start).getTime()) return true
  const aEnd = a.end ? asDate(a.end).getTime() : null
  const bEnd = b.end ? asDate(b.end).getTime() : null
  return aEnd !== bEnd
}

/** Keep FS gaps when a task bar is dragged on the chart. */
export function applyFsScheduling(
  prevTasks: GanttTask[],
  nextTasks: GanttTask[],
  links: GanttLink[],
  movedIdHint?: number | string | null,
  options: FsSchedulingOptions = {}
): { tasks: GanttTask[]; links: GanttLink[] } {
  const movedId = movedIdHint ?? findMovedTaskId(prevTasks, nextTasks)
  if (!movedId || !fsLinks(links).length) {
    return { tasks: reconcileAllFsConstraints(nextTasks, links), links }
  }

  const oldTask = prevTasks.find((t) => String(t.id) === String(movedId))
  if (!oldTask) return { tasks: nextTasks, links }

  let tasks = nextTasks.map((t) => normalizeTaskDates(t))
  let updatedLinks = links

  const hasInbound = fsLinks(links).some((l) => String(l.target) === String(movedId))
  const { tasks: clampedTasks, clamped } = enforceSuccessorMinStart(tasks, updatedLinks, movedId)
  tasks = clampedTasks

  if (hasInbound && !clamped) {
    updatedLinks = updateInboundLags(updatedLinks, tasks, movedId)
  }

  const hasOutbound = fsLinks(updatedLinks).some((l) => String(l.source) === String(movedId))
  const allowBarMoveCorrection = options.barMove ?? false

  if (hasOutbound) {
    tasks = shiftOutboundSuccessorsWithPredecessor(
      tasks,
      updatedLinks,
      movedId,
      oldTask,
      allowBarMoveCorrection
    )
  }

  return { tasks: reconcileAllFsConstraints(tasks, updatedLinks), links: updatedLinks }
}

export function addFsDependency(
  tasks: GanttTask[],
  links: GanttLink[],
  sourceId: number | string,
  targetId: number | string
): { tasks: GanttTask[]; links: GanttLink[]; error?: string } {
  if (!sourceId || !targetId) {
    return { tasks, links, error: 'Select both a predecessor and successor.' }
  }
  if (String(sourceId) === String(targetId)) {
    return { tasks, links, error: 'A task cannot depend on itself.' }
  }
  if (hasFsLink(links, sourceId, targetId)) {
    return { tasks, links, error: 'This FS dependency already exists.' }
  }
  if (wouldCreateCycle(links, sourceId, targetId)) {
    return { tasks, links, error: 'This would create a circular dependency.' }
  }

  const source = tasks.find((t) => String(t.id) === String(sourceId))
  const target = tasks.find((t) => String(t.id) === String(targetId))
  const lag =
    source && target
      ? Math.max(0, differenceInCalendarDays(asDate(target.start), getTaskEnd(source)))
      : 0

  const link: GanttLink = {
    id: nextLinkId(links),
    source: coerceTaskId(sourceId),
    target: coerceTaskId(targetId),
    type: FS_LINK_TYPE,
    lag
  }

  return {
    tasks: shiftSuccessorAfterPredecessor(tasks, sourceId, targetId, lag),
    links: [...links, link]
  }
}

export function setFsLinkLag(
  tasks: GanttTask[],
  links: GanttLink[],
  linkId: number | string,
  lagDays: number
): { tasks: GanttTask[]; links: GanttLink[] } {
  const lag = Math.max(0, Math.round(lagDays))
  const link = links.find((l) => String(l.id) === String(linkId))
  if (!link || link.type !== FS_LINK_TYPE) return { tasks, links }

  const updatedLinks = links.map((item) =>
    String(item.id) === String(linkId) ? { ...item, lag } : item
  )
  let updatedTasks = shiftSuccessorAfterPredecessor(tasks, link.source, link.target, lag)
  updatedTasks = reconcileAllFsConstraints(updatedTasks, updatedLinks)

  return { tasks: updatedTasks, links: updatedLinks }
}

export function removeFsDependency(links: GanttLink[], linkId: number | string): GanttLink[] {
  return links.filter((l) => String(l.id) !== String(linkId))
}
