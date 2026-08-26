import { z } from 'zod'

export const PROJECT_STATE_SCHEMA_VERSION = '1.0.0' as const

export const TriageStateSchema = z.enum([
  'ACTION_NOW',
  'BLOCKED',
  'READY',
  'IN_PROGRESS',
  'VALIDATION',
  'HOLD',
  'DONE',
])

const IsoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, 'Expected a real calendar date')
const IdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const NonEmptyStringSchema = z.string().trim().min(1)

const TriageSourceSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('KNOWN'), sourceId: NonEmptyStringSchema }).strict(),
  z.object({ status: z.literal('UNKNOWN'), reason: NonEmptyStringSchema }).strict(),
  z.object({
    status: z.literal('CONFLICT'),
    sourceIds: z.array(NonEmptyStringSchema).min(2),
    reason: NonEmptyStringSchema,
  }).strict(),
])

const SourceSchema = z.object({
  kind: z.enum(['FIXTURE', 'REPOSITORY', 'MPE', 'MANUAL']),
  id: NonEmptyStringSchema,
}).strict()

const EvidenceLinkSchema = z.object({
  label: NonEmptyStringSchema,
  url: z.url(),
  sourceId: NonEmptyStringSchema,
}).strict()

const DependencySchema = z.object({
  projectId: IdSchema,
  sourceId: NonEmptyStringSchema,
}).strict()

const ToolSchema = z.object({
  id: NonEmptyStringSchema,
  sourceId: NonEmptyStringSchema,
}).strict()

const ApprovalSchema = z.object({
  id: NonEmptyStringSchema,
  status: z.enum(['PENDING', 'GRANTED', 'REJECTED']),
  sourceId: NonEmptyStringSchema,
}).strict()

const ProjectStateBaseSchema = z.object({
  schemaVersion: z.literal(PROJECT_STATE_SCHEMA_VERSION),
  id: IdSchema,
  name: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
  repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/).nullable(),
  triageState: TriageStateSchema.nullable(),
  triageSource: TriageSourceSchema,
  stage: NonEmptyStringSchema.nullable(),
  checkpoint: NonEmptyStringSchema.nullable(),
  progress: z.object({
    completed: z.number().int().nonnegative(),
    total: z.number().int().positive(),
  }).strict().nullable(),
  lastUpdated: IsoDateSchema,
  blocker: NonEmptyStringSchema.nullable(),
  nextAction: NonEmptyStringSchema.nullable(),
  evidenceLinks: z.array(EvidenceLinkSchema),
  dependencies: z.array(DependencySchema),
  tools: z.array(ToolSchema),
  approvals: z.array(ApprovalSchema),
  source: SourceSchema,
  staleAfterDays: z.number().int().positive(),
}).strict()

export const ProjectStateSchema = ProjectStateBaseSchema.superRefine((project, context) => {
  const statusIsUnknown = project.triageSource.status === 'UNKNOWN' || project.triageSource.status === 'CONFLICT'

  if ((project.triageState === null) !== statusIsUnknown) {
    context.addIssue({
      code: 'custom',
      path: ['triageState'],
      message: 'triageState must be null exactly when triageSource is UNKNOWN or CONFLICT',
    })
  }
  if (project.triageState === 'BLOCKED' && project.blocker === null) {
    context.addIssue({ code: 'custom', path: ['blocker'], message: 'BLOCKED projects require a blocker' })
  }
  if (project.triageState === 'ACTION_NOW' && project.nextAction === null) {
    context.addIssue({ code: 'custom', path: ['nextAction'], message: 'ACTION_NOW projects require a next action' })
  }
  if (project.progress && project.progress.completed > project.progress.total) {
    context.addIssue({ code: 'custom', path: ['progress'], message: 'completed cannot exceed total' })
  }
  if (project.dependencies.some((dependency) => dependency.projectId === project.id)) {
    context.addIssue({ code: 'custom', path: ['dependencies'], message: 'A project cannot depend on itself' })
  }
})

export const ProjectRegistrySchema = z.object({
  schemaVersion: z.literal(PROJECT_STATE_SCHEMA_VERSION),
  version: z.number().int().positive(),
  updatedAt: IsoDateSchema,
  projects: z.array(ProjectStateSchema).min(1),
}).strict().superRefine((registry, context) => {
  const seen = new Set<string>()
  registry.projects.forEach((project, index) => {
    if (seen.has(project.id)) {
      context.addIssue({ code: 'custom', path: ['projects', index, 'id'], message: 'Project ids must be unique' })
    }
    seen.add(project.id)
  })
})

export type TriageState = z.infer<typeof TriageStateSchema>
export type ProjectState = z.infer<typeof ProjectStateSchema>
export type ProjectRegistry = z.infer<typeof ProjectRegistrySchema>
export type Freshness = 'FRESH' | 'STALE'

export function parseProjectRegistry(input: unknown): ProjectRegistry {
  return ProjectRegistrySchema.parse(input)
}

export function getFreshness(project: ProjectState, now: Date): Freshness {
  const lastUpdated = new Date(`${project.lastUpdated}T00:00:00Z`).getTime()
  const elapsedDays = Math.floor((now.getTime() - lastUpdated) / 86_400_000)
  return elapsedDays >= project.staleAfterDays ? 'STALE' : 'FRESH'
}
