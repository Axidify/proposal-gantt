export type TimelineUnit = 'day' | 'month' | 'year'
export type TimelineMode = 'relative' | 'calendar'
export type TimelineZoom = 'hour' | 'day' | 'week' | 'month' | 'year'

/** Chart interaction mode (Phase B2). */
export type ChartInteractionMode = 'select' | 'schedule' | 'link'

export interface ProposalMeta {
  title: string
  client: string
  preparedBy: string
  date: string
  notes: string
  timelineUnit?: TimelineUnit
  timelineZoom?: TimelineZoom
  timelineMode?: TimelineMode
  projectStartDate?: string
}

export interface GanttTask {
  id: number | string
  text: string
  start: Date | string
  end?: Date | string
  duration?: number
  progress?: number
  type?: 'task' | 'summary' | 'milestone'
  parent?: number | string
  open?: boolean
  details?: string
}

export interface GanttLink {
  id: number | string
  source: number | string
  target: number | string
  type: 'e2s' | 's2s' | 's2e' | 'e2e'
  /** Finish-to-start lag in days (gap between predecessor end and successor start). */
  lag?: number
}

export interface ProposalDocument {
  version: 1
  meta: ProposalMeta
  tasks: GanttTask[]
  links: GanttLink[]
}

export interface ThemeId {
  id: string
  name: string
  accent: string
  accentLight: string
}
