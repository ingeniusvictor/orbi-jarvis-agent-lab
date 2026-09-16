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

const compactModelText = (value) =>
  normalize(value)
    .replace(/\b(?:modelo|model)\b/g, '')
    .replace(/[^a-z0-9.]+/g, '')

const QWEN_SPEECH_ALIASES = [
  'qwen',
  'qwin',
  'qween',
  'queen',
  'qeen',
  'quen',
  'kwen',
  'cuen',
]

function soundsLikeQwen(value) {
  const compact = compactModelText(value)
  return QWEN_SPEECH_ALIASES.some((alias) => compact.includes(alias))
}

function requestedSize(value) {
  const text = normalize(value)
    .replace(/(\d)\s+b\b/g, '$1b')
    .replace(/(\d)\s*[.,]\s*(\d)\s*b\b/g, '$1.$2b')

  const match = text.match(/\b(1\.7b|4b|7b|8b|14b|32b|70b)\b/)
  return match?.[1] ?? null
}

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
  const compact = compactModelText(requested)
  const size = requestedSize(requested)
  const qwenRequested = soundsLikeQwen(requested)

  // Browser speech recognition often hears "Qwen" as queen/qeen/qwin and may
  // insert spaces around generation/size numbers. Resolve the family + size
  // deterministically before falling back to general aliases.
  if (qwenRequested && size) {
    const qwenBySize = firstMatching(installed, [
      (n) => compactModelText(n).includes('qwen') && requestedSize(n) === size,
    ])
    if (qwenBySize) return qwenBySize
  }

  // Canonical compact matching ignores punctuation such as qwen3:4b vs
  // speech text "qwen 3 4b".
  const compactExact = installed.find(
    (name) => compactModelText(name) === compact,
  )
  if (compactExact) return compactExact

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
    q === '4b'
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
    (n) => compactModelText(n).includes(compact),
    (n) => compact.includes(compactModelText(n)),
    (n) => n.includes(q.replace(/\s+/g, '')),
    (n) => n.includes(q),
  ])
}

export function parseModelControl(prompt) {
  const raw = String(prompt ?? '').trim()
  const text = normalize(raw)
  if (!text) return null

  const asksForInventory =
    /\bque modelos? (?:puedo|puedes|puede|podemos) usar\b/.test(text) ||
    /\bque modelos? (?:tienes|hay|estan)\b/.test(text) ||
    /\bmodelos? (?:disponibles|instalados)\b/.test(text) ||
    /\b(?:lista|listar|muestra|mostrar|dime) (?:los )?modelos\b/.test(text)

  if (asksForInventory) {
    return { action: 'list' }
  }

  const patterns = [
    /(?:puedes |podrias |puede )?(?:cambiar|cambia|cambiate) (?:al modelo |de modelo a |a )(.+)/i,
    /(?:quiero que |por favor )?(?:uses|usa|utiliza|activa|pon) (?:el modelo )?(.+)/i,
    /(?:ponte|pasate|pasa) (?:al modelo |a )(.+)/i,
  ]

  const withoutName = raw.replace(/^(?:lumi|lumia)[,\s:.-]*/i, '').trim()

  for (const pattern of patterns) {
    const match = pattern.exec(withoutName)
    const requested = match?.[1]?.trim().replace(/[?.!]+$/, '').trim()
    if (requested) return { action: 'switch', requested }
  }

  return null
}

export function buildModelInventory(installedModels) {
  return (installedModels ?? []).map((name) => ({
    name,
    profile: modelProfileFor(name),
    active: name === getActiveModel(),
  }))
}
