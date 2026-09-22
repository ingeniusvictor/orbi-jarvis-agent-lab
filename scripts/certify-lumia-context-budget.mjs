#!/usr/bin/env node
import { classifySurface, collectContextBudget, estimateContent } from './ecc-lumia-context-budget.mjs'

const expected = new Map([
  ['AGENTS.md', 'always-instructions'],
  ['.agents/skills/example/SKILL.md', 'discoverable-skill'],
  ['.orbi/ecc-profile.json', 'config-reference'],
  ['.orbi/lumia-agent-observation-v1.schema.json', 'config-reference'],
  ['docs/example.md', 'other'],
])

for (const [surface, kind] of expected) {
  const actual = classifySurface(surface)
  if (actual !== kind) throw new Error(`classification mismatch for ${surface}: ${actual} != ${kind}`)
}

const stats = estimateContent('one two three\nfour')
if (stats.lines !== 2 || stats.words !== 4 || stats.chars <= 0) {
  throw new Error('content estimate sanity check failed')
}

const report = await collectContextBudget(process.cwd())
if (report.schemaVersion !== 1) throw new Error('unexpected report schema version')
if (report.counts.alwaysInstructions < 1) throw new Error('AGENTS.md was not discovered as always-instructions')
if (report.counts.discoverableSkills < 1) throw new Error('project skills were not discovered')
if (report.counts.configReferences < 1) throw new Error('config references were not discovered')
if (report.estimates.persistentInstructionTokens <= 0) throw new Error('persistent instruction estimate must be positive')

console.log(JSON.stringify({
  marker: 'LUMIA_CONTEXT_BUDGET_CERTIFICATION_PASS',
  counts: report.counts,
  estimates: report.estimates,
  flags: report.surfaces.filter((x) => x.flags.length).map((x) => ({ path: x.path, flags: x.flags })),
}))
