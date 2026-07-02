import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Gantt, Willow } from '@svar-ui/react-gantt'
import '@svar-ui/react-gantt/all.css'
import type { GanttLink, GanttTask, TimelineMode, TimelineZoom } from '../types'
import type { GanttChartActions } from '../lib/ganttActions'
import { addDays } from 'date-fns'
import { coerceTaskId } from '../lib/dependencies'
import { asDate, toCalendarTasks } from '../lib/timeline'
import {
  autofitChart,
  buildZoomConfig,
  defaultChartRange,
  levelToZoomPreset,
  ZOOM_LEVEL_ORDER,
  ZOOM_PRESET_LABELS,
  ZOOM_PRESETS,
  zoomPresetToLevel,
  zoomPresetToTimelineUnit
} from '../lib/ganttZoom'
import { buildGanttColumns } from '../lib/gantt/columns'
import type { AddTaskInterceptEvent } from '../lib/gantt/intercepts'
import { applyAddTaskRequest, applyMilestoneToggle } from '../lib/gantt/taskMutations'
import { GanttChartContext } from '../context/GanttChartContext'
import { useGanttApi } from '../hooks/useGanttApi'
import { useDragToLink } from '../hooks/useDragToLink'
import { LinkDragOverlay } from './LinkDragOverlay'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

interface GanttViewProps {
  tasks: GanttTask[]
  links: GanttLink[]
  timelineZoom: TimelineZoom
  timelineMode: TimelineMode
  projectStartDate: string
  onTimelineZoomChange: (zoom: TimelineZoom) => void
  onTimelineModeChange: (mode: TimelineMode) => void
  onTasksChange: (tasks: GanttTask[]) => void
  onLinksChange: (links: GanttLink[]) => void
  onRegisterChartActions?: (actions: GanttChartActions) => void
  chartDocumentKey: string
}

export function GanttView({
  tasks,
  links,
  timelineZoom,
  timelineMode,
  projectStartDate,
  onTimelineZoomChange,
  onTimelineModeChange,
  onTasksChange,
  onLinksChange,
  onRegisterChartActions,
  chartDocumentKey
}: GanttViewProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [linkMode, setLinkMode] = useState(false)
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
  const [chartRange, setChartRange] = useState<{ start: Date; end: Date }>(() =>
    defaultChartRange(tasks, timelineMode, projectStartDate)
  )

  const timelineUnit = zoomPresetToTimelineUnit(timelineZoom)
  const ganttKey = `${chartDocumentKey}-${timelineMode}-${projectStartDate}-${timelineZoom}`

  const { handleInit, applyFsLink, setChartData } = useGanttApi({
    tasks,
    links,
    onTasksChange,
    onLinksChange,
    onRegisterChartActions,
    onLinkMessage: setLinkMessage
  })

  useEffect(() => {
    setChartData({ tasks, links, timelineMode, projectStartDate })
  }, [tasks, links, timelineMode, projectStartDate, setChartData])

  const ganttTasks = useMemo(() => {
    const base =
      timelineMode === 'calendar' ? toCalendarTasks(tasks, projectStartDate) : tasks
    return base.map((task) => {
      const start = asDate(task.start)
      if (task.end) return task
      if (task.type === 'milestone') return { ...task, end: start }
      if (task.duration != null) return { ...task, end: addDays(start, task.duration) }
      return task
    })
  }, [tasks, timelineMode, projectStartDate])

  const zoomConfig = useMemo(
    () => buildZoomConfig(timelineMode, timelineZoom),
    [timelineMode, timelineZoom]
  )

  useEffect(() => {
    setChartRange(defaultChartRange(tasks, timelineMode, projectStartDate))
  }, [chartDocumentKey, timelineMode, projectStartDate])

  const columns = useMemo(
    () => buildGanttColumns(timelineUnit, timelineMode),
    [timelineUnit, timelineMode]
  )

  const handleAddTask = useCallback(
    (request: AddTaskInterceptEvent) => {
      onTasksChange(applyAddTaskRequest(tasks, request))
    },
    [onTasksChange, tasks]
  )

  const handleToggleMilestone = useCallback(
    (taskId: number | string, asMilestone: boolean) => {
      onTasksChange(applyMilestoneToggle(tasks, taskId, asMilestone))
    },
    [onTasksChange, tasks]
  )

  const chartContextValue = useMemo(
    () => ({
      onAddTask: handleAddTask,
      onToggleMilestone: handleToggleMilestone
    }),
    [handleAddTask, handleToggleMilestone]
  )

  const handleAutofit = useCallback(() => {
    const { range, preset } = autofitChart(ganttTasks)
    setChartRange(range)
    onTimelineZoomChange(preset)
  }, [ganttTasks, onTimelineZoomChange])

  const handleZoomStep = useCallback(
    (dir: 1 | -1) => {
      const currentLevel = zoomPresetToLevel(timelineZoom)
      const nextLevel = Math.min(Math.max(currentLevel + dir, 0), ZOOM_LEVEL_ORDER.length - 1)
      if (nextLevel === currentLevel) return
      onTimelineZoomChange(levelToZoomPreset(nextLevel))
    },
    [onTimelineZoomChange, timelineZoom]
  )

  const drag = useDragToLink(chartRef, linkMode, (sourceId, targetId) => {
    void applyFsLink(coerceTaskId(sourceId), coerceTaskId(targetId))
  })

  return (
    <GanttChartContext.Provider value={chartContextValue}>
      <div
        className={`gantt-chart proposal-gantt-theme${linkMode ? ' link-mode-active' : ''}${drag ? ' link-dragging' : ''}`}
      >
      <div className="gantt-toolbar">
        <div className="timeline-unit-toggle" role="group" aria-label="Timeline mode">
          <button
            type="button"
            className={`gantt-tool-btn${timelineMode === 'relative' ? ' is-active' : ''}`}
            onClick={() => onTimelineModeChange('relative')}
          >
            Relative
          </button>
          <button
            type="button"
            className={`gantt-tool-btn${timelineMode === 'calendar' ? ' is-active' : ''}`}
            onClick={() => onTimelineModeChange('calendar')}
          >
            Start date
          </button>
        </div>

        <span className="toolbar-divider" />

        <div className="gantt-zoom-controls" role="group" aria-label="Timeline zoom">
          <button
            type="button"
            className="gantt-tool-btn gantt-tool-icon"
            onClick={() => handleZoomStep(-1)}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} strokeWidth={2} />
          </button>
          <div className="timeline-unit-toggle" role="group" aria-label="Zoom preset">
            {ZOOM_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`gantt-tool-btn${timelineZoom === preset ? ' is-active' : ''}`}
                onClick={() => onTimelineZoomChange(preset)}
                title={ZOOM_PRESET_LABELS[preset]}
              >
                {ZOOM_PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="gantt-tool-btn gantt-tool-icon"
            onClick={() => handleZoomStep(1)}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="gantt-tool-btn gantt-tool-icon"
            onClick={handleAutofit}
            title="Fit timeline to tasks"
            aria-label="Fit timeline to tasks"
          >
            <Maximize2 size={15} strokeWidth={2} />
          </button>
        </div>

        <span className="toolbar-divider" />

        <button
          type="button"
          className={`gantt-tool-btn${linkMode ? ' is-active' : ''}`}
          onClick={() => {
            setLinkMode((on) => !on)
            setLinkMessage(null)
          }}
        >
          {linkMode ? 'Linking' : 'Link'}
        </button>
        {linkMessage && <span className="gantt-tool-error">{linkMessage}</span>}
      </div>

      <div ref={chartRef} className="gantt-chart-body">
        <LinkDragOverlay drag={drag} />
        <Willow>
          <Gantt
            key={ganttKey}
            tasks={ganttTasks}
            links={links}
            columns={columns}
            start={chartRange.start}
            end={chartRange.end}
            zoom={zoomConfig}
            autoScale={false}
            weekStart={1}
            init={handleInit}
          />
        </Willow>
      </div>
    </div>
    </GanttChartContext.Provider>
  )
}
