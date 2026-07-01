import { useEffect, useRef, useState, type RefObject } from 'react'

export interface DragLinkState {
  sourceId: string
  x: number
  y: number
  currentX: number
  currentY: number
}

function taskIdFromLinkHandle(target: EventTarget | null, side: 'left' | 'right'): string | null {
  const link = (target as Element | null)?.closest?.('.wx-link')
  if (!link) return null
  if (side === 'left' && !link.classList.contains('wx-left')) return null
  if (side === 'right' && !link.classList.contains('wx-right')) return null
  const bar = link.closest('[data-task-id]')
  return bar?.getAttribute('data-task-id') ?? null
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
      const sourceId = taskIdFromLinkHandle(event.target, 'right')
      if (!sourceId) return

      event.preventDefault()
      event.stopPropagation()

      const handle = (event.target as Element).closest('.wx-link') ?? (event.target as Element)
      const rect = handle.getBoundingClientRect()
      const next: DragLinkState = {
        sourceId,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
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

      const targetId = taskIdFromLinkHandle(event.target, 'left')
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
