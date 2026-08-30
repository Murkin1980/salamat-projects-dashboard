import { z } from 'zod'

export const HistoryEventTypeSchema = z.enum(['CHECKPOINT_MOVED', 'STATE_CHANGED', 'BLOCKER_CHANGED'])

export const HistoryEventSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  projectId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  occurredAt: z.iso.datetime({ offset: true }),
  type: HistoryEventTypeSchema,
  from: z.string().trim().min(1).nullable(),
  to: z.string().trim().min(1).nullable(),
  summary: z.string().trim().min(1),
  sourceId: z.string().regex(/^[a-f0-9]{40}$/),
  evidenceUrl: z.url(),
}).strict().superRefine((event, context) => {
  if (event.from === event.to) context.addIssue({ code: 'custom', path: ['to'], message: 'History transition must change value' })
  if (event.type !== 'BLOCKER_CHANGED' && (event.from === null || event.to === null)) {
    context.addIssue({ code: 'custom', path: ['from'], message: 'Checkpoint and state transitions require from and to values' })
  }
})

export const ProjectHistorySchema = z.object({
  projectId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  projectName: z.string().trim().min(1),
  events: z.array(HistoryEventSchema),
}).strict().superRefine((history, context) => {
  const ids = new Set<string>()
  let previousTime = Number.NEGATIVE_INFINITY
  history.events.forEach((event, index) => {
    if (event.projectId !== history.projectId) context.addIssue({ code: 'custom', path: ['events', index, 'projectId'], message: 'Event project must match history project' })
    if (ids.has(event.id)) context.addIssue({ code: 'custom', path: ['events', index, 'id'], message: 'History event ids must be unique' })
    ids.add(event.id)
    const time = Date.parse(event.occurredAt)
    if (time < previousTime) context.addIssue({ code: 'custom', path: ['events', index, 'occurredAt'], message: 'History events must be chronological' })
    previousTime = time
  })
})

export const HistoryRegistrySchema = z.object({
  version: z.number().int().positive(),
  snapshotAt: z.iso.datetime({ offset: true }),
  projects: z.array(ProjectHistorySchema).min(1),
}).strict()

export type HistoryEvent = z.infer<typeof HistoryEventSchema>
export type HistoryEventType = z.infer<typeof HistoryEventTypeSchema>
export type ProjectHistory = z.infer<typeof ProjectHistorySchema>

export function parseHistoryRegistry(input: unknown) {
  return HistoryRegistrySchema.parse(input)
}

export function summarizeHistory(history: ProjectHistory) {
  return {
    checkpointMoves: history.events.filter((event) => event.type === 'CHECKPOINT_MOVED').length,
    stateChanges: history.events.filter((event) => event.type === 'STATE_CHANGED').length,
    blockerChanges: history.events.filter((event) => event.type === 'BLOCKER_CHANGED').length,
  }
}
