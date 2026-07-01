import type { ProposalDocument } from './types'
import { defaultProjectStartDate, offsetDay } from './timeline'

export const SAMPLE_PROPOSALS: { id: string; name: string; description: string; doc: ProposalDocument }[] = [
  {
    id: 'software-implementation',
    name: 'Software Implementation',
    description: 'Discovery through go-live for enterprise software rollout',
    doc: {
      version: 1,
      meta: {
        title: 'Enterprise Platform Implementation',
        client: 'Acme Corporation',
        preparedBy: 'Pre-Sales Team',
        date: new Date().toISOString().slice(0, 10),
        notes: 'Timeline assumes dedicated client resources and standard change management.',
        timelineUnit: 'month',
        timelineMode: 'relative'
      },
      tasks: [
        { id: 1, text: 'Project Phases', type: 'summary', start: offsetDay(0), duration: 84, open: true },
        { id: 10, text: 'Discovery & Requirements', type: 'summary', parent: 1, start: offsetDay(0), duration: 14, open: true },
        { id: 11, text: 'Stakeholder workshops', type: 'task', parent: 10, start: offsetDay(0), duration: 5, progress: 0 },
        { id: 12, text: 'Requirements sign-off', type: 'milestone', parent: 10, start: offsetDay(14), duration: 0 },
        { id: 20, text: 'Design & Architecture', type: 'summary', parent: 1, start: offsetDay(14), duration: 21, open: true },
        { id: 21, text: 'Solution design', type: 'task', parent: 20, start: offsetDay(14), duration: 10, progress: 0 },
        { id: 22, text: 'Technical architecture review', type: 'task', parent: 20, start: offsetDay(24), duration: 7, progress: 0 },
        { id: 23, text: 'Design approval', type: 'milestone', parent: 20, start: offsetDay(35), duration: 0 },
        { id: 30, text: 'Build & Configure', type: 'summary', parent: 1, start: offsetDay(35), duration: 28, open: true },
        { id: 31, text: 'Core configuration', type: 'task', parent: 30, start: offsetDay(35), duration: 14, progress: 0 },
        { id: 32, text: 'Integrations & data migration', type: 'task', parent: 30, start: offsetDay(42), duration: 14, progress: 0 },
        { id: 33, text: 'UAT readiness', type: 'milestone', parent: 30, start: offsetDay(63), duration: 0 },
        { id: 40, text: 'Deploy & Hypercare', type: 'summary', parent: 1, start: offsetDay(63), duration: 21, open: true },
        { id: 41, text: 'User acceptance testing', type: 'task', parent: 40, start: offsetDay(63), duration: 10, progress: 0 },
        { id: 42, text: 'Go-live', type: 'milestone', parent: 40, start: offsetDay(77), duration: 0 },
        { id: 43, text: 'Hypercare support', type: 'task', parent: 40, start: offsetDay(77), duration: 7, progress: 0 }
      ],
      links: [
        { id: 1, source: 12, target: 21, type: 'e2s' },
        { id: 2, source: 23, target: 31, type: 'e2s' },
        { id: 3, source: 33, target: 41, type: 'e2s' },
        { id: 4, source: 42, target: 43, type: 'e2s' }
      ]
    }
  },
  {
    id: 'consulting-engagement',
    name: 'Consulting Engagement',
    description: 'Assessment, strategy, and phased delivery roadmap',
    doc: {
      version: 1,
      meta: {
        title: 'Digital Transformation Roadmap',
        client: 'Northwind Industries',
        preparedBy: 'Advisory Practice',
        date: new Date().toISOString().slice(0, 10),
        notes: 'Phased approach with executive checkpoints at each gate.',
        timelineUnit: 'month',
        timelineMode: 'relative'
      },
      tasks: [
        { id: 1, text: 'Engagement', type: 'summary', start: offsetDay(0), duration: 56, open: true },
        { id: 10, text: 'Current state assessment', type: 'task', parent: 1, start: offsetDay(0), duration: 10, progress: 0 },
        { id: 11, text: 'Assessment readout', type: 'milestone', parent: 1, start: offsetDay(10), duration: 0 },
        { id: 20, text: 'Strategy & prioritization', type: 'task', parent: 1, start: offsetDay(10), duration: 14, progress: 0 },
        { id: 21, text: 'Executive alignment', type: 'milestone', parent: 1, start: offsetDay(24), duration: 0 },
        { id: 30, text: 'Wave 1 — Quick wins', type: 'task', parent: 1, start: offsetDay(24), duration: 14, progress: 0 },
        { id: 40, text: 'Wave 2 — Foundation', type: 'task', parent: 1, start: offsetDay(38), duration: 21, progress: 0 },
        { id: 50, text: 'Program closeout', type: 'milestone', parent: 1, start: offsetDay(56), duration: 0 }
      ],
      links: [
        { id: 1, source: 11, target: 20, type: 'e2s' },
        { id: 2, source: 21, target: 30, type: 'e2s' },
        { id: 3, source: 30, target: 40, type: 'e2s' }
      ]
    }
  }
]

export function createBlankProposal(): ProposalDocument {
  return {
    version: 1,
    meta: {
      title: 'Untitled Proposal',
      client: '',
      preparedBy: '',
      date: new Date().toISOString().slice(0, 10),
      notes: '',
      timelineUnit: 'day',
      timelineMode: 'relative',
      projectStartDate: defaultProjectStartDate()
    },
    tasks: [
      {
        id: 1,
        text: 'Phase 1',
        type: 'summary',
        start: offsetDay(0),
        duration: 14,
        open: true
      },
      {
        id: 2,
        text: 'Kickoff',
        type: 'task',
        parent: 1,
        start: offsetDay(0),
        duration: 3,
        progress: 0
      },
      {
        id: 3,
        text: 'Delivery',
        type: 'task',
        parent: 1,
        start: offsetDay(3),
        duration: 7,
        progress: 0
      },
      {
        id: 4,
        text: 'Go-live',
        type: 'milestone',
        parent: 1,
        start: offsetDay(14),
        duration: 0
      }
    ],
    links: [{ id: 1, source: 2, target: 3, type: 'e2s' }]
  }
}
