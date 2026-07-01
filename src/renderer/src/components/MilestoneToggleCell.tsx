import type { MouseEvent } from 'react'
import { Diamond } from 'lucide-react'
import type { IApi } from '@svar-ui/react-gantt'
import type { GanttTask } from '../types'
import { milestoneTogglePatch } from '../lib/tasks'

interface MilestoneToggleCellProps {
  row: Pick<GanttTask, 'id' | 'type' | 'start' | 'duration' | 'progress'>
  api: IApi
}

export function MilestoneToggleCell({ row, api }: MilestoneToggleCellProps) {
  if (row.type === 'summary') return null

  const isMilestone = row.type === 'milestone'

  const toggle = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    void api.exec('update-task', {
      id: row.id,
      task: milestoneTogglePatch(row, !isMilestone)
    })
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
