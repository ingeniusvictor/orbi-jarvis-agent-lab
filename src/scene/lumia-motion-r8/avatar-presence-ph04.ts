/**
 * L.U.M.I.A. PH-04 — owner-authorized local avatar view/gesture controls.
 *
 * - User commands are parsed only after App.respond accepts a voice/text turn.
 * - No tools, OS control, microphone access, browser navigation/reload or LLM.
 * - One React/Three Canvas remains mounted when switching portrait/bust/body.
 * - Existing PH-03 Motion R8 owns the 17 optional, private FBX files.
 * - Missing/incompatible clips cannot be claimed as successfully played.
 */
import { motionCatalog } from './motion-library-catalog.js'

export type LumiaAvatarView = 'head-vrm' | 'bust-vrm' | 'body-vrm' | 'legacy'
export type LumiaAvatarAction =
  | { kind: 'view'; view: Exclude<LumiaAvatarView, 'legacy'> }
  | { kind: 'motion'; id: string }
  | { kind: 'auto' }
  | { kind: 'list-views' }
  | { kind: 'list-motions' }
  | { kind: 'describe' }

export type LumiaAvatarSnapshot = {
  view: LumiaAvatarView
  sequence: number
  motion: { sequence: number; id: string | null; kind: 'play' | 'auto'; sentAt: number } | null
}

const AVAILABLE_VIEWS: Record<Exclude<LumiaAvatarView, 'legacy'>, string> = {
  'head-vrm': 'solo rostro',
  'bust-vrm': 'medio cuerpo',
  'body-vrm': 'cuerpo completo',
}
const viewKeys = new Set<LumiaAvatarView>(['head-vrm', 'bust-vrm', 'body-vrm', 'legacy'])
const motionIds = new Set(motionCatalog.map((item) => item.id))

const fold = (text: string): string => String(text ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')

export function resolveAvatarView(search = '', enabled = false): LumiaAvatarView {
  const requested = new URLSearchParams(search).get('lumiaAvatar') as LumiaAvatarView | null
  return requested && viewKeys.has(requested) ? requested : enabled ? 'bust-vrm' : 'legacy'
}

export function avatarViewLabel(view: LumiaAvatarView): string {
  return AVAILABLE_VIEWS[view as keyof typeof AVAILABLE_VIEWS] ?? 'avatar anterior'
}

export function parseLumiaAvatarAction(prompt: string): LumiaAvatarAction | null {
  const said = fold(prompt).replace(/^(?:(?:hola|oye|hey)\s+)?(?:lumi|lumia|lo mi)\s+/, '')
  if (!said) return null

  // Read-only questions are allowed and never cause a view or gesture change.
  if (/^(?:que|cuales|cuantas|como|dime|cuentame|comentame|explicame)\b/.test(said)) {
    if (/\b(?:animaciones|movimientos|gestos)\b/.test(said) &&
      /\b(?:tienes|disponibles|puedes|haces|sabes|catalogo)\b/.test(said)) {
      return { kind: 'list-motions' }
    }
    if (/\b(?:vistas|modos de vista|apariencias|presentaciones)\b/.test(said)) {
      return { kind: 'list-views' }
    }
    if (/\b(?:cuerpo virtual|avatar|cuerpo animado|presencia virtual)\b/.test(said)) {
      return { kind: 'describe' }
    }
    return null
  }

  if (/^(?:lista|enumera|menciona)\s+(?:tus\s+)?(?:17\s+)?(?:animaciones|movimientos|gestos)\b/.test(said)) {
    return { kind: 'list-motions' }
  }
  if (/^(?:lista|menciona|muestrame)\s+(?:las\s+)?(?:tres\s+)?vistas\b/.test(said)) {
    return { kind: 'list-views' }
  }

  // PH-04.1 field QA: Whisper can transcribe "cuerpo completo" as "corrup
  // completo", and users naturally ask "puedes cambiar ..." or "necesito que
  // cambias ...". Keep those narrow alternatives behind explicit view context.
  const viewContext = /\b(?:vista|vistas|presentacion|rostro|cara|cabeza|cuerpo|corrup|corpo|curpo|busto)\b/.test(said)
  const viewInquiry = /^(?:solo\s+)?(?:quiero\s+probar|me\s+gustaria\s+probar|quisiera\s+probar|puedes\s+cambiar\s+entre|quiero\s+saber\s+si\s+(?:puedes|podrias)\s+cambiar|como\s+(?:cambio|cambiar)\s+(?:la\s+)?vista)\b/.test(said)
  if (viewContext && viewInquiry) return { kind: 'list-views' }

  const directChange = /^(?:por\s+favor\s+)?(?:(?:me\s+)?(?:puedes|podrias|podria)\s+)?(?:cambia|cambiame|cambiar|cambiarme|cambias|cambies|cambiate|ponte|pon|muestra|muestrate|pasa|pasate|colocate|quiero\s+verte|dejame\s+verte|vuelve|regresa|retorna)\b/.test(said)
  const requestedChange = /^(?:necesito|quiero|quisiera|me\s+gustaria)\s+que\s+(?:(?:me|te)\s+)?(?:cambia|cambias|cambies|cambiaras|cambiar)\b/.test(said)
  if (viewContext && (directChange || requestedChange)) {
    const wantsHead = /\b(?:solo\s+(?:el\s+)?rostro|solo\s+la\s+cara|solo\s+(?:la\s+)?cabeza|la\s+cabeza|el\s+rostro|cara\s+solamente|primer\s+plano)\b/.test(said)
    const wantsFull = /\b(?:cuerpo|corrup|corpo|curpo)\s+(?:completo|entero)\b|\b(?:de\s+pies\s+a\s+cabeza|vista\s+completa)\b/.test(said)
    const wantsBust = /\b(?:medio\s+cuerpo|mitad\s+del\s+cuerpo|vista\s+intermedia|busto|vista\s+principal|vista\s+predeterminada|vista\s+por\s+defecto|vista\s+normal)\b/.test(said)
    const targets = [
      ...(wantsHead ? ['head-vrm'] : []),
      ...(wantsFull ? ['body-vrm'] : []),
      ...(wantsBust ? ['bust-vrm'] : []),
    ] as Array<Exclude<LumiaAvatarView, 'legacy'>>
    // Do not arbitrarily choose when the user names multiple different views
    // or Whisper truncates the command before its target. Ask instead.
    if (targets.length !== 1) return { kind: 'list-views' }
    return { kind: 'view', view: targets[0] }
  }

  if (/^(?:vuelve|regresa|retorna|deja|deten|para|desactiva)\b/.test(said) &&
    /\b(?:modo natural|modo automatico|animaciones automaticas|animacion automatica|gestos automaticos|movimiento automatico|gestos manuales)\b/.test(said)) {
    return { kind: 'auto' }
  }

  const motionCommand = /^(?:haz|hace|ejecuta|realiza|activa|reproduce|pon|muestra|muestrame|saluda|saludame|aplaude|camina|senala|niega)\b/.test(said)
  if (!motionCommand) return null
  // All 17 catalog IDs are also directly addressable by their exact ID:
  // "Lumi, ejecuta animación pointing", "Lumi reproduce animación walking".
  // Never accept a free-form clip path or URL.
  const exact = said.match(/^(?:ejecuta|reproduce|activa)\s+(?:(?:la|el|una|un)\s+)?(?:animacion|movimiento|gesto)\s+(?:de\s+)?([a-z0-9]+)$/)
  if (exact && motionIds.has(exact[1])) return { kind: 'motion', id: exact[1] }

  const motions: Array<[RegExp, string]> = [
    [/\b(?:saluda|saludame|saludo|saludar|waving)\b/, 'waving'],
    [/\b(?:aplaude|aplauso|aplaudir|clapping)\b/, 'clapping'],
    [/\b(?:beso|besito|lanzar un beso)\b/, 'kiss'],
    [/\b(?:senalamiento directo|senalamiento simple|senalala con un dedo|senala con un dedo|pointing simple)\b/, 'pointing'],
    [/\b(?:senala|senalar|apunta|apuntar|pointing gesture)\b/, 'pointinggesture'],
    [/\b(?:niega|negacion|di que no|gesto de no)\b/, 'no'],
    [/\b(?:pensar|pensando|reflexion|thinking)\b/, 'thinking'],
    [/\b(?:alegria|feliz|happy)\b/, 'happy'],
    [/\b(?:entusiasmo|emocionada|excited)\b/, 'excited'],
    [/\b(?:sorpresa|sorprendida|surprised)\b/, 'surprised'],
    [/\b(?:camina|caminar en circulo|paseo circular)\b/, 'walkingcircle'],
    [/\b(?:caminar en sitio|camina en sitio|caminar sin avanzar)\b/, 'walking'],
    [/\b(?:caminar hacia delante|camina hacia delante)\b/, 'walkingforward'],
    [/\b(?:hablar|conversacion|talking)\b/, 'talking'],
    [/\b(?:reposo|descanso|quieta|idle)\b/, 'idle'],
    [/\b(?:escuchar|escuchando|head gesture)\b/, 'listening'],
    [/\b(?:revisar las manos|revisa tus manos|revisa las manos|unas|nails)\b/, 'nails'],
  ]
  for (const [pattern, id] of motions) {
    if (pattern.test(said) && motionIds.has(id)) return { kind: 'motion', id }
  }
  return null
}

export const PH04_AVATAR_EVENT = 'lumia:ph04-avatar-presence' as const

const ph04Enabled = typeof import.meta.env !== 'undefined' &&
  import.meta.env.VITE_LUMIA_AVATAR_PH04 === '1'
let snapshot: LumiaAvatarSnapshot = {
  view: resolveAvatarView(typeof window === 'undefined' ? '' : window.location.search, ph04Enabled),
  sequence: 0,
  motion: null,
}
const listeners = new Set<() => void>()
const notify = () => { for (const listener of listeners) listener() }

export function avatarPresenceSnapshot(): LumiaAvatarSnapshot { return snapshot }
export function subscribeAvatarPresence(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setLumiaAvatarView(view: LumiaAvatarView): boolean {
  if (!viewKeys.has(view)) return false
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    url.searchParams.set('lumiaAvatar', view)
    // Experimental clipping and PH-01 baseline flags must not leak into a
    // later owner-selected presentation.
    url.searchParams.delete('lumiaNeck')
    url.searchParams.delete('lumiaHeadQA')
    window.history.replaceState(window.history.state, '', url.toString())
  }
  if (snapshot.view !== view) {
    snapshot = { ...snapshot, view, sequence: snapshot.sequence + 1 }
    notify()
  }
  return true
}

export function requestLumiaAvatarMotion(id: string): boolean {
  if (!motionIds.has(id)) return false
  if (snapshot.view === 'legacy' || snapshot.view === 'head-vrm') {
    setLumiaAvatarView('bust-vrm') // Face & body gesture must remain visible.
  }
  const sequence = snapshot.sequence + 1
  snapshot = { ...snapshot, sequence, motion: { sequence, id, kind: 'play', sentAt: Date.now() } }
  notify()
  return true
}

export function resumeLumiaAvatarMotion(): void {
  const sequence = snapshot.sequence + 1
  snapshot = { ...snapshot, sequence, motion: { sequence, id: null, kind: 'auto', sentAt: Date.now() } }
  notify()
}

export function respondToLumiaAvatarAction(action: LumiaAvatarAction): string {
  if (action.kind === 'view') {
    setLumiaAvatarView(action.view)
    return 'He cambiado mi presentación a ' + avatarViewLabel(action.view) + '.'
  }
  if (action.kind === 'motion') {
    // Do not claim an FBX was even requested while the user deliberately
    // selected procedural-only mode as a safe rollback.
    if (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('lumiaR8') === 'procedural') {
      return 'Esta vista está en modo corporal procedural, sin archivos FBX. ' +
        'Para reproducir una animación específica abre la vista de medio cuerpo normal, sin el parámetro procedural.'
    }
    const catalog = motionCatalog.find((entry) => entry.id === action.id)
    if (!catalog || !requestLumiaAvatarMotion(action.id)) return 'Ese movimiento no está registrado en Motion R8.'
    return 'Voy a intentar el movimiento ' + catalog.label + '. Si el archivo no está disponible, continuaré con mi postura natural.'
  }
  if (action.kind === 'auto') {
    resumeLumiaAvatarMotion()
    return 'He vuelto al modo de movimientos automáticos de Motion R8.'
  }
  if (action.kind === 'list-views') {
    return 'Sí, puedo cambiar entre tres vistas: solo rostro, medio cuerpo y cuerpo completo. Mi vista principal es medio cuerpo, con mi rostro centrado en los aros. Dime cuál quieres que active.'
  }
  if (action.kind === 'list-motions') {
    const shortList = motionCatalog.map((item) => item.label)
    return 'Tengo un catálogo de diecisiete animaciones Motion R8: ' +
      shortList.join(', ') +
      '. Para ejecutarlas necesito que sus archivos estén instalados y sean compatibles con el avatar.'
  }
  return 'Dispongo de un avatar virtual con tres vistas intercambiables y un catálogo de diecisiete movimientos Motion R8. Mis gestos acompañan la conversación, y puedo intentar reproducir un movimiento concreto cuando me lo pidas. El funcionamiento de cada animación depende de su archivo local y compatibilidad.'
}
