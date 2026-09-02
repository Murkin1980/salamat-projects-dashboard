import assert from 'node:assert/strict'
import { test } from 'node:test'
import { edgePresentation } from '../src/graph/edge-presentation.js'

test('every relationship has a distinct color and human label', () => {
  const entries = Object.values(edgePresentation)
  assert.equal(new Set(entries.map((entry) => entry.color)).size, entries.length)
  assert.ok(entries.every((entry) => entry.label.length > 3))
  assert.ok(entries.every((entry) => entry.description.includes('Источник')))
})

test('only evidence and divergence use semantic dash patterns', () => {
  assert.equal(edgePresentation.uses.dash, undefined)
  assert.equal(edgePresentation.depends_on.dash, undefined)
  assert.equal(edgePresentation.reports_to.dash, undefined)
  assert.ok(edgePresentation.evidence_for.dash)
  assert.ok(edgePresentation.diverged_from.dash)
})
