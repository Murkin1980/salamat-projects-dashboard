import { z } from 'zod'

export const ExperimentStatusSchema = z.enum(['IDEA', 'PLANNED', 'READY_TO_TEST', 'RUNNING', 'PASS', 'FAIL', 'HOLD', 'ADOPTED'])
export const ExperimentRegistrySchema = z.object({
  schema_version: z.literal('1.0.0'),
  updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.literal('Murkin1980/murat-project-engineer'),
  source_url: z.string().url(),
  experiments: z.array(z.object({
    experiment_id: z.string().min(1), name: z.string().min(1), owning_project: z.string().min(1),
    status: ExperimentStatusSchema, next_action: z.string().min(1), updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    repo: z.string().min(1), evidence_url: z.string().url(),
  }).strict()).min(1),
}).strict().superRefine((registry, ctx) => {
  const seen = new Set<string>()
  registry.experiments.forEach((experiment, index) => {
    if (seen.has(experiment.experiment_id)) ctx.addIssue({ code: 'custom', path: ['experiments', index, 'experiment_id'], message: 'Experiment ids must be unique' })
    seen.add(experiment.experiment_id)
  })
})
export type ExperimentRegistry = z.infer<typeof ExperimentRegistrySchema>
export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>
export function parseExperimentRegistry(input: unknown): ExperimentRegistry { return ExperimentRegistrySchema.parse(input) }
