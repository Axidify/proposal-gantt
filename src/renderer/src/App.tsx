import { useCallback, useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { GanttLink, GanttTask, ProposalDocument } from './types'
import type { GanttChartActions } from './lib/ganttActions'
import { createBlankProposal, SAMPLE_PROPOSALS } from './lib/templates'
import { documentTitle, parseDocument, reviveDocument, serializeDocument } from './lib/document'
import { timelineModeLabel } from './lib/timeline'
import { zoomPresetToTimelineUnit } from './lib/ganttZoom'
import { normalizeMilestoneTaskPatch } from './lib/tasks'
import { applyTheme, type ThemeId } from './lib/themes'
import { Header } from './components/Header'
import { InspectorPanel } from './components/InspectorPanel'
import { GanttView } from './components/GanttView'
import { WelcomeScreen } from './components/WelcomeScreen'
import './styles/app.css'

export default function App() {
  const [document, setDocument] = useState<ProposalDocument | null>(null)
  const [filePath, setFilePath] = useState<string | undefined>()
  const [dirty, setDirty] = useState(false)
  const [theme, setTheme] = useState<ThemeId>('ocean')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [documentEpoch, setDocumentEpoch] = useState(0)
  const [selectedTaskId, setSelectedTaskId] = useState<number | string | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const chartActionsRef = useRef<GanttChartActions | null>(null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const markDirty = useCallback(() => setDirty(true), [])

  const loadDocument = useCallback((doc: ProposalDocument, path?: string) => {
    setDocument(reviveDocument(doc))
    setFilePath(path)
    setDirty(false)
    setSelectedTaskId(null)
    setDocumentEpoch((epoch) => epoch + 1)
  }, [])

  const handleNew = useCallback(() => {
    loadDocument(createBlankProposal())
  }, [loadDocument])

  const handleOpen = useCallback(async () => {
    const result = await window.api.openFile()
    if (!result) return
    try {
      loadDocument(parseDocument(result.content), result.path)
    } catch {
      alert('Could not open this file. Please choose a valid .pgantt proposal.')
    }
  }, [loadDocument])

  const handleSave = useCallback(async () => {
    if (!document) return
    const path = await window.api.saveFile(serializeDocument(document), filePath)
    if (path) {
      setFilePath(path)
      setDirty(false)
    }
  }, [document, filePath])

  const handleTemplate = useCallback(
    (templateId: string) => {
      const template = SAMPLE_PROPOSALS.find((t) => t.id === templateId)
      if (template) loadDocument(structuredClone(template.doc))
    },
    [loadDocument]
  )

  const updateDocument = useCallback(
    (updater: (prev: ProposalDocument) => ProposalDocument) => {
      setDocument((prev) => {
        if (!prev) return prev
        const next = updater(prev)
        setDirty(true)
        return next
      })
    },
    []
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
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave, handleOpen, handleNew])

  if (!document) {
    return (
      <WelcomeScreen
        onNew={handleNew}
        onOpen={() => void handleOpen()}
        onTemplate={handleTemplate}
        templates={SAMPLE_PROPOSALS}
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
        onInspectorToggle={() => setInspectorOpen((open) => !open)}
        onThemeChange={setTheme}
        onNew={handleNew}
        onOpen={() => void handleOpen()}
        onSave={() => void handleSave()}
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
