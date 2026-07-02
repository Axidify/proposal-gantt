import { describe, expect, it } from 'vitest'
import type { ProposalDocument } from '../types'
import {
  applyDocumentUpdate,
  canRedoHistory,
  canUndoHistory,
  createInitialHistoryState,
  loadHistoryDocument,
  redoDocument,
  undoDocument
} from './documentHistory'

function doc(title: string): ProposalDocument {
  return {
    version: 1,
    meta: {
      title,
      client: '',
      preparedBy: '',
      date: '2026-07-02',
      notes: ''
    },
    tasks: [],
    links: []
  }
}

describe('documentHistory', () => {
  it('tracks undo and redo across edits', () => {
    let state = loadHistoryDocument(createInitialHistoryState(), doc('A'))
    state = applyDocumentUpdate(state, (d) => ({ ...d, meta: { ...d.meta, title: 'B' } }))
    state = applyDocumentUpdate(state, (d) => ({ ...d, meta: { ...d.meta, title: 'C' } }))

    expect(state.document?.meta.title).toBe('C')
    expect(canUndoHistory(state)).toBe(true)

    state = undoDocument(state)
    expect(state.document?.meta.title).toBe('B')
    expect(canRedoHistory(state)).toBe(true)

    state = redoDocument(state)
    expect(state.document?.meta.title).toBe('C')
  })

  it('clears future stack on a new edit after undo', () => {
    let state = loadHistoryDocument(createInitialHistoryState(), doc('A'))
    state = applyDocumentUpdate(state, (d) => ({ ...d, meta: { ...d.meta, title: 'B' } }))
    state = undoDocument(state)
    state = applyDocumentUpdate(state, (d) => ({ ...d, meta: { ...d.meta, title: 'D' } }))

    expect(state.document?.meta.title).toBe('D')
    expect(canRedoHistory(state)).toBe(false)
  })

  it('skips history when requested', () => {
    let state = loadHistoryDocument(createInitialHistoryState(), doc('A'))
    state = applyDocumentUpdate(
      state,
      (d) => ({ ...d, meta: { ...d.meta, title: 'B' } }),
      { skipHistory: true }
    )

    expect(state.document?.meta.title).toBe('B')
    expect(canUndoHistory(state)).toBe(false)
  })
})
