import { useEffect, useRef, useState, type RefObject } from 'react'

export interface DragLinkState {
  sourceId: string
  x: number
  y: number
  currentX: number
  currentY: number
}

/** Pixels from a bar corner that still count as grabbing a link handle. */
const CORNER_HIT_RADIUS = 22

function barFromTarget(target: EventTarget | null): Element | null {
  const el = target as Element | null
  if (!el?.closest) return null
  return el.closest('.wx-bar') ?? el.closest('[data-task-id]')
}

function taskIdFromBar(bar: Element | null): string | null {
  return bar?.getAttribute('data-task-id') ?? null
}

function isNearBarCorner(event: MouseEvent, bar: Element, side: 'left' | 'right'): boolean {
  const rect = bar.getBoundingClientRect()
  const cornerX = side === 'right' ? rect.right : rect.left
  const withinY = event.clientY >= rect.top - 8 && event.clientY <= rect.bottom + 8
  if (!withinY) return false
  return Math.abs(event.clientX - cornerX) <= CORNER_HIT_RADIUS
}

function findNearestBarCorner(
  root: HTMLElement,
  event: MouseEvent,
  side: 'left' | 'right',
  excludeId?: string
): string | null {
  const bars = root.querySelectorAll('.wx-bar[data-task-id], [data-task-id].wx-bar')
  let best: { id: string; dist: number } | null = null

  for (const bar of bars) {
    const id = bar.getAttribute('data-task-id')
    if (!id || id === excludeId) continue
    if (!isNearBarCorner(event, bar, side)) continue

    const rect = bar.getBoundingClientRect()
    const cornerX = side === 'left' ? rect.left : rect.right
    const cornerY = rect.top + rect.height / 2
    const dist = Math.hypot(event.clientX - cornerX, event.clientY - cornerY)
    if (!best || dist < best.dist) best = { id, dist }
  }

  return best?.id ?? null
}

function barForTaskId(root: HTMLElement, taskId: string): Element | null {
  const escaped = taskId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return (
    root.querySelector(`.wx-bar[data-task-id="${escaped}"]`) ??
    root.querySelector(`[data-task-id="${escaped}"]`)?.closest('.wx-bar') ??
    null
  )
}

function barCornerPoint(bar: Element, side: 'left' | 'right'): { x: number; y: number } {
  const rect = bar.getBoundingClientRect()
  return {
    x: side === 'right' ? rect.right : rect.left,
    y: rect.top + rect.height / 2
  }
}

function taskIdFromLinkHandle(
  target: EventTarget | null,
  side: 'left' | 'right',
  event?: MouseEvent
): string | null {
  const link = (target as Element | null)?.closest?.('.wx-link')
  if (link) {
    if (side === 'left' && link.classList.contains('wx-left')) {
      return taskIdFromBar(link.closest('.wx-bar') ?? link.closest('[data-task-id]'))
    }
    if (side === 'right' && link.classList.contains('wx-right')) {
      return taskIdFromBar(link.closest('.wx-bar') ?? link.closest('[data-task-id]'))
    }
  }

  if (!event) return null
  const bar = barFromTarget(event.target)
  if (!bar || !isNearBarCorner(event, bar, side)) return null
  return taskIdFromBar(bar)
}

export function useDragToLink(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onComplete: (sourceId: string, targetId: string) => void
) {
  const [drag, setDrag] = useState<DragLinkState | null>(null)
  const dragRef = useRef<DragLinkState | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    dragRef.current = drag
  }, [drag])

  useEffect(() => {
    const root = containerRef.current
    if (!root || !enabled) return

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      let sourceId = taskIdFromLinkHandle(event.target, 'right', event)
      if (!sourceId) {
        sourceId = findNearestBarCorner(root, event, 'right')
      }
      if (!sourceId) return

      event.preventDefault()
      event.stopPropagation()

      const sourceBar = barForTaskId(root, sourceId)
      const start = sourceBar ? barCornerPoint(sourceBar, 'right') : { x: event.clientX, y: event.clientY }
      const next: DragLinkState = {
        sourceId,
        x: start.x,
        y: start.y,
        currentX: event.clientX,
        currentY: event.clientY
      }
      dragRef.current = next
      setDrag(next)
    }

    const onMouseMove = (event: MouseEvent) => {
      const current = dragRef.current
      if (!current) return
      const next = { ...current, currentX: event.clientX, currentY: event.clientY }
      dragRef.current = next
      setDrag(next)
    }

    const onMouseUp = (event: MouseEvent) => {
      const current = dragRef.current
      if (!current) return

      let targetId = taskIdFromLinkHandle(event.target, 'left', event)
      if (!targetId) {
        targetId = findNearestBarCorner(root, event, 'left', current.sourceId)
      }
      if (targetId && targetId !== current.sourceId) {
        onCompleteRef.current(current.sourceId, targetId)
      }

      dragRef.current = null
      setDrag(null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dragRef.current) {
        dragRef.current = null
        setDrag(null)
      }
    }

    root.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      root.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [containerRef, enabled])

  return drag
}
