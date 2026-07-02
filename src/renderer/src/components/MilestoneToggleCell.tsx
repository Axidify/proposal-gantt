import type { MouseEvent } from 'react'
import { Diamond } from 'lucide-react'
import type { GanttTask } from '../types'
import { useGanttChartContext } from '../context/GanttChartContext'

interface MilestoneToggleCellProps {
  row: Pick<GanttTask, 'id' | 'type' | 'start' | 'duration' | 'progress'>
}

export function MilestoneToggleCell({ row }: MilestoneToggleCellProps) {
  const { onToggleMilestone } = useGanttChartContext()
  if (row.type === 'summary') return null

  const isMilestone = row.type === 'milestone'

  const toggle = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onToggleMilestone(row.id, !isMilestone)
  }

  return (
    <button
      type="button"
      className={`milestone-toggle${isMilestone ? ' is-on' : ''}`}
      aria-pressed={isMilestone}
      title={isMilestone ? 'Convert to task' : 'Mark as milestone'}
      onClick={toggle}
    >
      <Diamond size={14} strokeWidth={isMilestone ? 2.25 : 1.75} />
    </button>
  )
}
