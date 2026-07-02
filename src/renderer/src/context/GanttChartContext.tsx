import { createContext, useContext } from 'react'
import type { AddTaskInterceptEvent } from '../lib/gantt/intercepts'

export interface GanttChartContextValue {
  onAddTask: (request: AddTaskInterceptEvent) => void
  onToggleMilestone: (taskId: number | string, asMilestone: boolean) => void
}

export const GanttChartContext = createContext<GanttChartContextValue | null>(null)

export function useGanttChartContext(): GanttChartContextValue {
  const ctx = useContext(GanttChartContext)
  if (!ctx) {
    throw new Error('useGanttChartContext must be used within GanttChartContext.Provider')
  }
  return ctx
}
