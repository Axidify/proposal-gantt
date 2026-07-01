import type { DragLinkState } from '../hooks/useDragToLink'

interface LinkDragOverlayProps {
  drag: DragLinkState | null
}

export function LinkDragOverlay({ drag }: LinkDragOverlayProps) {
  if (!drag) return null

  return (
    <svg className="link-drag-overlay" aria-hidden="true">
      <defs>
        <marker
          id="link-drag-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)" />
        </marker>
      </defs>
      <line
        x1={drag.x}
        y1={drag.y}
        x2={drag.currentX}
        y2={drag.currentY}
        stroke="var(--accent)"
        strokeWidth="2"
        strokeDasharray="6 4"
        markerEnd="url(#link-drag-arrow)"
      />
      <circle cx={drag.x} cy={drag.y} r="5" fill="var(--accent)" />
      <circle cx={drag.currentX} cy={drag.currentY} r="4" fill="var(--accent-light)" />
    </svg>
  )
}
