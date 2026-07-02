import type { MouseEvent } from 'react'
import { FolderPlus, Plus } from 'lucide-react'
import type { IApi } from '@svar-ui/react-gantt'
import { useGanttChartContext } from '../context/GanttChartContext'

interface AddRowCellProps {
  row: { id: number | string; type?: string; parent?: number | string }
  api: IApi
}

export function AddRowCell({ row }: AddRowCellProps) {
  const { onAddTask } = useGanttChartContext()
  const isSummary = row.type === 'summary'

  const add = (kind: 'task' | 'summary') => (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const isPhase = kind === 'summary'
    const mode = isPhase ? 'after' : isSummary ? 'child' : 'after'

    onAddTask({
      target: row.id,
      mode,
      task: {
        type: isPhase ? 'summary' : 'task',
        text: isPhase ? 'New Phase' : 'New Task',
        duration: isPhase ? 14 : 3,
        progress: 0,
        open: isPhase ? true : undefined
      }
    })
  }

  return (
    <div className="add-row-actions">
      <button
        type="button"
        className="add-row-btn"
        title={isSummary ? 'Add task to phase' : 'Add task after'}
        aria-label={isSummary ? 'Add task to phase' : 'Add task after'}
        onClick={add('task')}
      >
        <Plus size={14} strokeWidth={2.25} />
      </button>
      {isSummary && (
        <button
          type="button"
          className="add-row-btn add-row-btn-phase"
          title="Add phase after"
          aria-label="Add phase after"
          onClick={add('summary')}
        >
          <FolderPlus size={14} strokeWidth={2.25} />
        </button>
      )}
    </div>
  )
}
