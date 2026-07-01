import { useState, type RefObject } from 'react'
import { Link2, Trash2 } from 'lucide-react'
import type { ProposalDocument } from '../types'
import type { GanttChartActions } from '../lib/ganttActions'
import { fsLinks, linkableTasks, taskLabel } from '../lib/dependencies'

interface DependenciesPanelProps {
  document: ProposalDocument
  onChange: (updater: (prev: ProposalDocument) => ProposalDocument) => void
  onDirty: () => void
  chartActionsRef: RefObject<GanttChartActions | null>
}

export function DependenciesPanel({
  document,
  onChange,
  onDirty,
  chartActionsRef
}: DependenciesPanelProps) {
  const [predecessor, setPredecessor] = useState('')
  const [successor, setSuccessor] = useState('')
  const [error, setError] = useState<string | null>(null)

  const candidates = linkableTasks(document.tasks)
  const dependencies = fsLinks(document.links)

  const handleAdd = async () => {
    const actions = chartActionsRef.current
    if (!actions) {
      setError('Chart is still loading. Try again in a moment.')
      return
    }

    const result = await actions.addFsLink(predecessor, successor)
    if (!result.ok) {
      setError(result.error)
      return
    }

    onDirty()
    setError(null)
    setPredecessor('')
    setSuccessor('')
  }

  const handleRemove = async (linkId: number | string) => {
    const actions = chartActionsRef.current
    if (actions) {
      await actions.removeFsLink(linkId)
    } else {
      onChange((d) => ({
        ...d,
        links: d.links.filter((l) => String(l.id) !== String(linkId))
      }))
    }
    onDirty()
  }

  const canAdd = predecessor && successor && predecessor !== successor

  return (
    <section className="panel-section">
      <h3>Dependencies (FS)</h3>
      <p className="panel-desc">
        Finish-to-start links: the predecessor must finish before the successor starts.
      </p>

      <label>
        Predecessor
        <select value={predecessor} onChange={(e) => setPredecessor(e.target.value)}>
          <option value="">Select task…</option>
          {candidates.map((task) => (
            <option key={task.id} value={String(task.id)}>
              {task.text}
            </option>
          ))}
        </select>
      </label>

      <label>
        Successor
        <select value={successor} onChange={(e) => setSuccessor(e.target.value)}>
          <option value="">Select task…</option>
          {candidates
            .filter((task) => String(task.id) !== predecessor)
            .map((task) => (
              <option key={task.id} value={String(task.id)}>
                {task.text}
              </option>
            ))}
        </select>
      </label>

      {error && <p className="panel-error">{error}</p>}

      <button type="button" className="btn btn-accent btn-block" disabled={!canAdd} onClick={handleAdd}>
        <Link2 size={15} />
        Add FS dependency
      </button>

      {dependencies.length > 0 && (
        <ul className="dep-list">
          {dependencies.map((link) => (
            <li key={link.id} className="dep-item">
              <span className="dep-label">
                {taskLabel(document.tasks, link.source)}
                <span className="dep-arrow">→</span>
                {taskLabel(document.tasks, link.target)}
              </span>
              <button
                type="button"
                className="dep-remove"
                title="Remove dependency"
                onClick={() => handleRemove(link.id)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
