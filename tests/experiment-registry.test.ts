import test from 'node:test'
import assert from 'node:assert/strict'
import registry from '../config/experiments.github.json' with { type: 'json' }
import { parseExperimentRegistry } from '../src/contract/experiment-registry.js'

test('canonical MPE experiment snapshot is valid and has unique identities', () => {
  const parsed = parseExperimentRegistry(registry)
  assert.equal(parsed.source, 'Murkin1980/murat-project-engineer')
  assert.equal(new Set(parsed.experiments.map((experiment) => experiment.experiment_id)).size, parsed.experiments.length)
  assert.ok(parsed.experiments.some((experiment) => experiment.status === 'PASS'))
})
