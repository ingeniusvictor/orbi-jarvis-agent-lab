#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const STATUS = new Set(['success', 'warning', 'error'])
const ARTIFACT_TYPES = new Set(['file','commit','pull-request','workflow','artifact','runtime','url','other'])
const EVIDENCE_TYPES = new Set(['certification','build','lint','security-scan','workflow','workstation-doctor','runtime-probe','human-consent','diff','other'])
const OUTCOMES = new Set(['pass','fail','pending','observed'])
const AUTHORITY_DOMAINS = new Set([
  'tool-writes','provider-secrets','speaker-identity','anti-replay',
  'camera-microphone','local-runtime','network-ssrf',
  'provider-preference','agent-memory','canonical-git',
])

const allowedTop = new Set([
  'schemaVersion','status','summary','nextActions','artifacts','evidence',
  'authorityImpact','localEvidenceRequired','recovery',
])

function isString(value, min = 1, max = Infinity) {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

function validateObservation(value) {
  const errors = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['observation must be an object']

  for (const key of Object.keys(value)) if (!allowedTop.has(key)) errors.push(`unexpected top-level property: ${key}`)

  if (value.schemaVersion !== 1) errors.push('schemaVersion must equal 1')
  if (!STATUS.has(value.status)) errors.push('status must be success, warning or error')
  if (!isString(value.summary, 1, 500)) errors.push('summary must be 1..500 characters')
  if (typeof value.localEvidenceRequired !== 'boolean') errors.push('localEvidenceRequired must be boolean')

  if (!Array.isArray(value.nextActions) || value.nextActions.length > 10 ||
      value.nextActions.some((x) => !isString(x, 1, 300))) {
    errors.push('nextActions must be an array of <=10 non-empty strings up to 300 characters')
  }

  if (!Array.isArray(value.artifacts) || value.artifacts.length > 20) {
    errors.push('artifacts must be an array of <=20 items')
  } else {
    value.artifacts.forEach((item, i) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return errors.push(`artifacts[${i}] must be an object`)
      const keys = Object.keys(item)
      if (keys.some((k) => !['type','ref','note'].includes(k))) errors.push(`artifacts[${i}] has unexpected property`)
      if (!ARTIFACT_TYPES.has(item.type)) errors.push(`artifacts[${i}].type is invalid`)
      if (!isString(item.ref, 1, 500)) errors.push(`artifacts[${i}].ref is invalid`)
      if (item.note !== undefined && !isString(item.note, 0, 500)) errors.push(`artifacts[${i}].note is invalid`)
    })
  }

  if (!Array.isArray(value.evidence) || value.evidence.length > 30) {
    errors.push('evidence must be an array of <=30 items')
  } else {
    value.evidence.forEach((item, i) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return errors.push(`evidence[${i}] must be an object`)
      if (Object.keys(item).some((k) => !['type','ref','outcome'].includes(k))) errors.push(`evidence[${i}] has unexpected property`)
      if (!EVIDENCE_TYPES.has(item.type)) errors.push(`evidence[${i}].type is invalid`)
      if (!isString(item.ref, 1, 500)) errors.push(`evidence[${i}].ref is invalid`)
      if (!OUTCOMES.has(item.outcome)) errors.push(`evidence[${i}].outcome is invalid`)
    })
  }

  const authority = value.authorityImpact
  if (!authority || typeof authority !== 'object' || Array.isArray(authority)) {
    errors.push('authorityImpact must be an object')
  } else {
    if (Object.keys(authority).some((k) => !['affected','domains','requiresHumanApproval','note'].includes(k))) errors.push('authorityImpact has unexpected property')
    if (typeof authority.affected !== 'boolean') errors.push('authorityImpact.affected must be boolean')
    if (typeof authority.requiresHumanApproval !== 'boolean') errors.push('authorityImpact.requiresHumanApproval must be boolean')
    if (!isString(authority.note ?? '', 0, 1000)) errors.push('authorityImpact.note must be <=1000 characters')
    if (!Array.isArray(authority.domains) || new Set(authority.domains).size !== authority.domains.length ||
        authority.domains.some((x) => !AUTHORITY_DOMAINS.has(x))) {
      errors.push('authorityImpact.domains contains invalid or duplicate values')
    }
    if (authority.requiresHumanApproval === true && authority.affected !== true) {
      errors.push('requiresHumanApproval=true requires affected=true')
    }
  }

  if (value.status === 'error') {
    const recovery = value.recovery
    if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)) {
      errors.push('error observations require recovery')
    } else {
      if (Object.keys(recovery).some((k) => !['rootCauseHint','safeRetry','stopCondition'].includes(k))) errors.push('recovery has unexpected property')
      for (const key of ['rootCauseHint','safeRetry','stopCondition']) {
        if (!isString(recovery[key], 1, 1000)) errors.push(`recovery.${key} must be 1..1000 characters`)
      }
    }
  }

  return errors
}

export { validateObservation }

if (process.argv[1]?.endsWith('validate-lumia-agent-observation.mjs')) {
  const path = process.argv[2]
  if (!path) {
    console.error('usage: node scripts/validate-lumia-agent-observation.mjs <observation.json>')
    process.exit(2)
  }
  let value
  try {
    value = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    console.error('INVALID JSON:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
  const errors = validateObservation(value)
  if (errors.length) {
    for (const error of errors) console.error('INVALID:', error)
    process.exit(1)
  }
  console.log('LUMIA_AGENT_OBSERVATION_VALID')
}
