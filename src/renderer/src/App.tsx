import { useCallback, useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { GanttLink, GanttTask, ProposalDocument } from './types'
import type { GanttChartActions } from './lib/ganttActions'
import { createBlankProposal, SAMPLE_PROPOSALS } from './lib/templates'
import { documentTitle, parseDocument, reviveDocument, serializeDocument } from './lib/document'
import { fsLinks, setFsLinkLag } from './lib/dependencies'
import { deleteTaskSubtree } from './lib/gantt/taskMutations'
import {
  applyDocumentUpdate,
  canRedoHistory,
  canUndoHistory,
  createInitialHistoryState,
  loadHistoryDocument,
  redoDocument,
  undoDocument,
  type DocumentHistoryState
} from './lib/documentHistory'
import { addRecentFile, listRecentFiles, removeRecentFile, type RecentFileEntry } from './lib/recentFiles'
import { timelineModeLabel } from './lib/timeline'
import { zoomPresetToTimelineUnit } from './lib/ganttZoom'
import { normalizeMilestoneTaskPatch } from './lib/tasks'
import { applyTheme, type ThemeId } from './lib/themes'
import { Header } from './components/Header'
import { InspectorPanel } from './components/InspectorPanel'
import { GanttView } from './components/GanttView'
import { WelcomeScreen } from './components/WelcomeScreen'
import './styles/app.css'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export default function App() {
  const [history, setHistory] = useState<DocumentHistoryState>(createInitialHistoryState)
  const [filePath, setFilePath] = useState<string | undefined>()
  const [dirty, setDirty] = useState(false)
  const [theme, setTheme] = useState<ThemeId>('ocean')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [documentEpoch, setDocumentEpoch] = useState(0)
  const [selectedTaskId, setSelectedTaskId] = useState<number | string | null>(null)
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>(() => listRecentFiles())
  const exportRef = useRef<HTMLDivElement>(null)
  const chartActionsRef = useRef<GanttChartActions | null>(null)

  const document = history.document

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const markDirty = useCallback(() => setDirty(true), [])

  const loadDocument = useCallback((doc: ProposalDocument, path?: string) => {
    setHistory(loadHistoryDocument(createInitialHistoryState(), doc))
    setFilePath(path)
    setDirty(false)
    setSelectedTaskId(null)
    setDocumentEpoch((epoch) => epoch + 1)
    if (path) setRecentFiles(addRecentFile(path, documentTitle(doc)))
  }, [])

  const updateDocument = useCallback(
    (updater: (prev: ProposalDocument) => ProposalDocument, options?: { skipHistory?: boolean }) => {
      setHistory((prev) => applyDocumentUpdate(prev, updater, options))
      setDirty(true)
    },
    []
  )

  const handleUndo = useCallback(() => {
    setHistory((prev) => undoDocument(prev))
    setDirty(true)
  }, [])

  const handleRedo = useCallback(() => {
    setHistory((prev) => redoDocument(prev))
    setDirty(true)
  }, [])

  const handleNew = useCallback(() => {
    loadDocument(createBlankProposal())
  }, [loadDocument])

  const openParsedDocument = useCallback(
    (content: string, path: string) => {
      try {
        loadDocument(parseDocument(content), path)
      } catch {
        alert('Could not open this file. Please choose a valid .pgantt proposal.')
      }
    },
    [loadDocument]
  )

  const handleOpen = useCallback(async () => {
    const result = await window.api.openFile()
    if (!result) return
    openParsedDocument(result.content, result.path)
  }, [openParsedDocument])

  const handleOpenRecent = useCallback(
    async (path: string) => {
      const result = await window.api.openFilePath(path)
      if (!result) {
        setRecentFiles(removeRecentFile(path))
        alert('Could not open this file. It may have been moved or deleted.')
        return
      }
      openParsedDocument(result.content, result.path)
    },
    [openParsedDocument]
  )

  const handleSave = useCallback(async () => {
    if (!document) return
    const path = await window.api.saveFile(serializeDocument(document), filePath)
    if (path) {
      setFilePath(path)
      setDirty(false)
      setRecentFiles(addRecentFile(path, documentTitle(document)))
    }
  }, [document, filePath])

  const handleTemplate = useCallback(
    (templateId: string) => {
      const template = SAMPLE_PROPOSALS.find((t) => t.id === templateId)
      if (template) loadDocument(structuredClone(template.doc))
    },
    [loadDocument]
  )

  const handleTasksChange = useCallback(
    (tasks: GanttTask[]) => updateDocument((d) => ({ ...d, tasks })),
    [updateDocument]
  )

  const handleLinksChange = useCallback(
    (links: GanttLink[]) => updateDocument((d) => ({ ...d, links })),
    [updateDocument]
  )

  const handleTaskPatch = useCallback(
    (taskId: number | string, patch: Partial<GanttTask>) => {
      updateDocument((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          String(t.id) === String(taskId)
            ? { ...t, ...normalizeMilestoneTaskPatch(taskId, patch, d.tasks) }
            : t
        )
      }))
    },
    [updateDocument]
  )

  const handleInboundLagChange = useCallback(
    (taskId: number | string, lagDays: number) => {
      updateDocument((d) => {
        const inbound = fsLinks(d.links).find((link) => String(link.target) === String(taskId))
        if (!inbound) return d
        const result = setFsLinkLag(d.tasks, d.links, inbound.id, lagDays)
        return { ...d, tasks: result.tasks, links: result.links }
      })
    },
    [updateDocument]
  )

  const handleDeleteSelectedTask = useCallback(() => {
    if (selectedTaskId == null) return
    const taskId = selectedTaskId
    updateDocument((d) => {
      const result = deleteTaskSubtree(d.tasks, d.links, taskId)
      return { ...d, tasks: result.tasks, links: result.links }
    })
    setSelectedTaskId(null)
  }, [selectedTaskId, updateDocument])

  useEffect(() => {
    if (selectedTaskId == null || !document) return
    if (!document.tasks.some((t) => String(t.id) === String(selectedTaskId))) {
      setSelectedTaskId(null)
    }
  }, [document, selectedTaskId])

  const handleRegisterChartActions = useCallback((actions: GanttChartActions) => {
    chartActionsRef.current = actions
  }, [])

  const captureExport = useCallback(async (format: 'png' | 'pdf') => {
    if (!exportRef.current) return
    const canvas = await html2canvas(exportRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    })

    if (format === 'png') {
      await window.api.exportFile(canvas.toDataURL('image/png'), 'png')
      return
    }

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    })
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
    const pdfBase64 = pdf.output('datauristring')
    await window.api.exportFile(pdfBase64, 'pdf')
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 's') {
        e.preventDefault()
        void handleSave()
      }
      if (mod && e.key === 'o') {
        e.preventDefault()
        void handleOpen()
      }
      if (mod && e.key === 'n') {
        e.preventDefault()
        handleNew()
      }
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!document || !canUndoHistory(history)) return
        e.preventDefault()
        handleUndo()
      }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        if (!document || !canRedoHistory(history)) return
        e.preventDefault()
        handleRedo()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && document && selectedTaskId != null) {
        if (isEditableTarget(e.target)) return
        e.preventDefault()
        handleDeleteSelectedTask()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    handleSave,
    handleOpen,
    handleNew,
    handleUndo,
    handleRedo,
    handleDeleteSelectedTask,
    document,
    history,
    selectedTaskId
  ])

  if (!document) {
    return (
      <WelcomeScreen
        onNew={handleNew}
        onOpen={() => void handleOpen()}
        onOpenRecent={(path) => void handleOpenRecent(path)}
        onTemplate={handleTemplate}
        templates={SAMPLE_PROPOSALS}
        recentFiles={recentFiles}
      />
    )
  }

  const title = documentTitle(document)
  const chartDocumentKey = filePath ?? `local-${documentEpoch}`

  return (
    <div className="app">
      <Header
        title={title}
        dirty={dirty}
        filePath={filePath}
        theme={theme}
        inspectorOpen={inspectorOpen}
        canUndo={canUndoHistory(history)}
        canRedo={canRedoHistory(history)}
        onInspectorToggle={() => setInspectorOpen((open) => !open)}
        onThemeChange={setTheme}
        onNew={handleNew}
        onOpen={() => void handleOpen()}
        onSave={() => void handleSave()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExportPng={() => void captureExport('png')}
        onExportPdf={() => void captureExport('pdf')}
      />
      <div className={`workspace${inspectorOpen ? '' : ' inspector-collapsed'}`}>
        {inspectorOpen && (
          <InspectorPanel
            document={document}
            selectedTaskId={selectedTaskId}
            onChange={updateDocument}
            onDirty={markDirty}
            onTaskChange={handleTaskPatch}
            onInboundLagChange={handleInboundLagChange}
            onDeleteTask={handleDeleteSelectedTask}
            chartActionsRef={chartActionsRef}
          />
        )}
        <main className="canvas">
          <div ref={exportRef} className="export-frame">
            <header className="export-header">
              <div className="export-header-main">
                <h2 className="export-title">{document.meta.title || 'Proposal Timeline'}</h2>
                {document.meta.client && (
                  <p className="export-client">Prepared for {document.meta.client}</p>
                )}
              </div>
              <div className="export-meta">
                <span className="export-timeline">
                  {timelineModeLabel(
                    document.meta.timelineMode ?? 'relative',
                    document.meta.timelineUnit ?? 'day',
                    document.meta.projectStartDate,
                    document.meta.timelineZoom
                  )}
                </span>
                {document.meta.preparedBy && <span>{document.meta.preparedBy}</span>}
                {document.meta.date && <span>{document.meta.date}</span>}
              </div>
            </header>
            <GanttView
              chartDocumentKey={chartDocumentKey}
              tasks={document.tasks}
              links={document.links}
              timelineZoom={document.meta.timelineZoom ?? 'day'}
              timelineMode={document.meta.timelineMode ?? 'relative'}
              projectStartDate={document.meta.projectStartDate ?? ''}
              onTimelineZoomChange={(zoom) =>
                updateDocument((d) => ({
                  ...d,
                  meta: {
                    ...d.meta,
                    timelineZoom: zoom,
                    timelineUnit: zoomPresetToTimelineUnit(zoom)
                  }
                }))
              }
              onTimelineModeChange={(mode) =>
                updateDocument((d) => ({ ...d, meta: { ...d.meta, timelineMode: mode } }))
              }
              onTasksChange={handleTasksChange}
              onLinksChange={handleLinksChange}
              onSelectedTaskChange={setSelectedTaskId}
              onRegisterChartActions={handleRegisterChartActions}
            />
            {document.meta.notes && <footer className="export-notes">{document.meta.notes}</footer>}
          </div>
        </main>
      </div>
    </div>
  )
}
