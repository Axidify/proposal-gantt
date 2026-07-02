import type { ProposalDocument } from '../types'
import { reviveDocument } from './document'

const MAX_HISTORY = 50

export interface DocumentHistoryState {
  document: ProposalDocument | null
  past: ProposalDocument[]
  future: ProposalDocument[]
}

export function snapshotDocument(doc: ProposalDocument): ProposalDocument {
  return structuredClone(doc)
}

export function createInitialHistoryState(): DocumentHistoryState {
  return { document: null, past: [], future: [] }
}

export function loadHistoryDocument(
  state: DocumentHistoryState,
  doc: ProposalDocument
): DocumentHistoryState {
  return { document: reviveDocument(doc), past: [], future: [] }
}

export function applyDocumentUpdate(
  state: DocumentHistoryState,
  updater: (prev: ProposalDocument) => ProposalDocument,
  options?: { skipHistory?: boolean }
): DocumentHistoryState {
  const { document, past, future } = state
  if (!document) return state

  const next = updater(document)
  if (next === document) return state
  if (options?.skipHistory) return { document: next, past, future }

  return {
    document: next,
    past: [...past.slice(-(MAX_HISTORY - 1)), snapshotDocument(document)],
    future: []
  }
}

export function undoDocument(state: DocumentHistoryState): DocumentHistoryState {
  const { document, past, future } = state
  if (!document || !past.length) return state

  const previous = past[past.length - 1]
  return {
    document: previous,
    past: past.slice(0, -1),
    future: [snapshotDocument(document), ...future]
  }
}

export function redoDocument(state: DocumentHistoryState): DocumentHistoryState {
  const { document, past, future } = state
  if (!document || !future.length) return state

  const next = future[0]
  return {
    document: next,
    past: [...past, snapshotDocument(document)],
    future: future.slice(1)
  }
}

export function canUndoHistory(state: DocumentHistoryState): boolean {
  return state.past.length > 0
}

export function canRedoHistory(state: DocumentHistoryState): boolean {
  return state.future.length > 0
}
