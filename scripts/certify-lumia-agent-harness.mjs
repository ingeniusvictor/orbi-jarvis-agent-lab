#!/usr/bin/env node
import { validateObservation } from './validate-lumia-agent-observation.mjs'

const valid = {
  schemaVersion: 1,
  status: 'warning',
  summary: 'Voice gate contract passed; workstation anti-replay evidence remains unavailable.',
  nextActions: ['Run workstation anti-replay certification before sensitive-action enablement.'],
  artifacts: [{ type: 'workflow', ref: 'run:example' }],
  evidence: [
    { type: 'certification', ref: 'npm run certify:voice-gate', outcome: 'pass' },
    { type: 'workstation-doctor', ref: 'anti-replay', outcome: 'pending' },
  ],
  authorityImpact: {
    affected: true,
    domains: ['speaker-identity', 'anti-replay'],
    requiresHumanApproval: true,
    note: 'No sensitive action should be authorized from speaker similarity alone.',
  },
  localEvidenceRequired: true,
}

const invalidErrorWithoutRecovery = { ...valid, status: 'error' }

const invalidApprovalWithoutImpact = {
  ...valid,
  authorityImpact: {
    affected: false,
    domains: [],
    requiresHumanApproval: true,
    note: 'Invalid contradictory authority state.',
  },
}

const invalidAuthorityWithoutNote = {
  ...valid,
  authorityImpact: {
    affected: true,
    domains: ['tool-writes'],
    requiresHumanApproval: true,
  },
}

const validErrors = validateObservation(valid)
if (validErrors.length) throw new Error(`valid observation rejected: ${validErrors.join('; ')}`)

const missingRecoveryErrors = validateObservation(invalidErrorWithoutRecovery)
if (!missingRecoveryErrors.some((x) => x.includes('require recovery'))) {
  throw new Error('error observation without recovery was not rejected')
}

const contradictoryAuthorityErrors = validateObservation(invalidApprovalWithoutImpact)
if (!contradictoryAuthorityErrors.some((x) => x.includes('requiresHumanApproval'))) {
  throw new Error('contradictory human-approval state was not rejected')
}

const missingNoteErrors = validateObservation(invalidAuthorityWithoutNote)
if (!missingNoteErrors.some((x) => x.includes('note is required'))) {
  throw new Error('authorityImpact without note was not rejected')
}

console.log('LUMIA_AGENT_HARNESS_CERTIFICATION_PASS')
