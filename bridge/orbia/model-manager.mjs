/**
 * O.R.B.I.A. Adaptive Model Runtime — AMR-01.
 *
 * Keeps L.U.M.I.A. provider-neutral while allowing the local Ollama model to
 * change at runtime. Selection is deterministic and limited to models that
 * Ollama reports as installed on the current machine.
 */

const DEFAULT_MODEL = 'qwen3:4b'

let activeModel =
  process.env.JARVIS_OLLAMA_MODEL ??
  process.env.ORBIA_LUMIA_MODEL ??
  DEFAULT_MODEL

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9:.+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function getActiveModel() {
  return activeModel
}

export function setActiveModel(model) {
  const next = String(model ?? '').trim()
  if (!next) throw new Error('A model name is required.')
  activeModel = next
  return activeModel
}

export function modelProfileFor(name) {
  const n = normalize(name)
  if (/1[.]7b/.test(n)) return 'fast'
  if (n.includes('coder') || n.includes('code')) return 'coding'
  if (/4b/.test(n) || n.includes('lumia')) return 'balanced'
  if (/7b|8b|14b|32b|70b/.test(n)) return 'heavy'
  return 'general'
}

function exactInstalled(requested, installed) {
  const target = normalize(requested)
  return installed.find((name) => normalize(name) === target) ?? null
}

function firstMatching(installed, tests) {
  for (const test of tests) {
    const found = installed.find((name) => test(normalize(name)))
    if (found) return found
  }
  return null
}

export function resolveModelRequest(requested, installedModels) {
  const installed = [...new Set((installedModels ?? []).map(String).filter(Boolean))]
  if (!installed.length) return null

  const exact = exactInstalled(requested, installed)
  if (exact) return exact

  const q = normalize(requested)

  if (
    q.includes('rapido') ||
    q.includes('ligero') ||
    q.includes('fast') ||
    q.includes('1.7')
  ) {
    return firstMatching(installed, [
      (n) => n.includes('qwen3:1.7b'),
      (n) => n.includes('1.7b'),
      (n) => modelProfileFor(n) === 'fast',
    ])
  }

  if (
    q.includes('equilibrado') ||
    q.includes('balanceado') ||
    q.includes('principal') ||
    q.includes('balanced') ||
    q === '4b' ||
    q.includes('qwen 4')
  ) {
    return firstMatching(installed, [
      (n) => n.includes('orbia-lumia:4b'),
      (n) => n.includes('qwen3:4b'),
      (n) => /4b/.test(n),
    ])
  }

  if (
    q.includes('codigo') ||
    q.includes('coder') ||
    q.includes('programacion') ||
    q.includes('programador')
  ) {
    return firstMatching(installed, [
      (n) => n.includes('coder') && /7b|8b|14b|32b/.test(n),
      (n) => n.includes('coder'),
    ])
  }

  if (q.includes('7b') || q.includes('7 b') || q.includes('qwen 7')) {
    return firstMatching(installed, [
      (n) => /7b/.test(n) && n.includes('coder'),
      (n) => /7b/.test(n),
    ])
  }

  return firstMatching(installed, [
    (n) => n.includes(q.replace(/\s+/g, '')),
    (n) => n.includes(q),
  ])
}

export function parseModelControl(prompt) {
  const raw = String(prompt ?? '').trim()
  const text = normalize(raw)
  if (!text) return null

  if (
    text.includes('que modelos puedo usar') ||
    text.includes('que modelos tienes') ||
    text.includes('modelos disponibles') ||
    text.includes('lista los modelos') ||
    text.includes('listar modelos')
  ) {
    return { action: 'list' }
  }

  const switchIntent =
    text.includes('cambia al modelo') ||
    text.includes('cambiar al modelo') ||
    text.includes('usa el modelo') ||
    text.includes('utiliza el modelo') ||
    text.includes('activa el modelo') ||
    text.includes('pon el modelo')

  if (!switchIntent) return null

  const cleaned = raw
    .replace(/^(?:lumi|lumia)[,\s:.-]*/i, '')
    .replace(/.*?(?:cambia(?:r)? al modelo|usa el modelo|utiliza el modelo|activa el modelo|pon el modelo)\s*/i, '')
    .trim()

  return cleaned ? { action: 'switch', requested: cleaned } : null
}

export function buildModelInventory(installedModels) {
  return (installedModels ?? []).map((name) => ({
    name,
    profile: modelProfileFor(name),
    active: name === getActiveModel(),
  }))
}
