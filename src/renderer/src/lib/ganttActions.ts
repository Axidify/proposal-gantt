export type AddFsLinkResult = { ok: true } | { ok: false; error: string }

export type GanttChartActions = {
  addFsLink: (sourceId: string | number, targetId: string | number) => Promise<AddFsLinkResult>
  removeFsLink: (linkId: string | number) => Promise<void>
}
