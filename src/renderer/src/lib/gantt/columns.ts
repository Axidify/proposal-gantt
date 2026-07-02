import type { TimelineMode, TimelineUnit } from '../types'
import { getTimelineColumns } from '../timeline'
import { AddRowCell } from '../../components/AddRowCell'
import { MilestoneToggleCell } from '../../components/MilestoneToggleCell'

export function buildGanttColumns(unit: TimelineUnit, mode: TimelineMode) {
  const [taskCol, ...rest] = getTimelineColumns(unit, mode)
  return [
    taskCol,
    {
      id: 'milestone-toggle',
      header: '◆',
      width: 36,
      align: 'center' as const,
      resize: false,
      cell: MilestoneToggleCell
    },
    ...rest,
    {
      id: 'add-task',
      header: '',
      width: 56,
      align: 'center' as const,
      resize: false,
      cell: AddRowCell
    }
  ]
}
