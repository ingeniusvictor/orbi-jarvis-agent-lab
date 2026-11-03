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
  | { kind: 'status' }
  | { kind: 'demo' }
  | { kind: 'demo-stop' }
  | { kind: 'animation-info' }

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
  return requested && viewKeys.has(requested) ? requested : enabled ? 'head-vrm' : 'legacy'
}

export function avatarViewLabel(view: LumiaAvatarView): string {
  return AVAILABLE_VIEWS[view as keyof typeof AVAILABLE_VIEWS] ?? 'avatar anterior'
}

export function parseLumiaAvatarAction(prompt: string): LumiaAvatarAction | null {
  const said = fold(prompt).replace(/^(?:(?:hola|oye|hey)\s+)?(?:lumi|lumia|lo mi)\s+/, '')
  if (!said) return null

  // A live demo needs explicit owner intent and an avatar-related target.
  // Distinguish "puedes hacer una demostración de tus animaciones" from
  // explaining the concept of animation or changing an Ollama model.
  if (/^(?:para|deten|detiene|cancela|termina|finaliza|detenme|para ya)\s+(?:(?:la|mi|tu|esta)\s+)?(?:demostracion|demo|recorrido)\b/.test(said)) {
    return { kind: 'demo-stop' }
  }
  const demoPrompt = /^(?:(?:puedes|podrias|me puedes|me podrias)\s+)?(?:hacer|hacerme|mostrar|mostrarme|realizar|iniciar|comenzar|activar|dar|haz|hazme|hace|muestra|muestrame|realiza|inicia|comienza|activa|dame)\s+(?:(?:una|la|tu|tus)\s+)?(?:demostracion|demo|recorrido)\b/.test(said) ||
    /^(?:quiero ver|quiero que hagas|me gustaria ver)\s+(?:(?:una|la)\s+)?(?:demostracion|demo|recorrido)\b/.test(said) ||
    /^(?:muestrame|ensename|demuestra)\s+(?:tus|las)\s+(?:animaciones|movimientos|gestos)\b/.test(said)
  // Actual ASUS STT: polite corrections and "voy a hacer..." are narrow
  // requests for a tour of *my* R8 animations, not video production.
  const demoCorrection = /^(?:no(?: [a-z]+){0,3} )?lo que quiero es que me des (?:una|la) demostracion de (?:tus|las) (?:animaciones|movimientos|gestos)\b/.test(said) ||
    /^(?:quiero|necesito) que me des (?:una|la) demostracion de tus (?:animaciones|movimientos|gestos)\b/.test(said) ||
    /^voy a hacer (?:una|la) demostracion de tus (?:animaciones|movimientos|gestos)\b/.test(said) ||
    /^(?:mi\s+)?quiero que me des (?:una|la) demostracion de tus (?:animaciones|movimientos|gestos)\b/.test(said) ||
    /^no\s+(?:lo\s+mio|lo\s+mismo|alumnos)\s+lo que quiero es que me des (?:una|la) demostracion de tus (?:animaciones|movimientos|gestos)\b/.test(said)
  if (demoCorrection || (demoPrompt && /\b(?:animaciones|movimientos|gestos|expresiones|emociones|avatar|vrm|cuerpo|capacidades|habilidades)\b/.test(said))) {
    return { kind: 'demo' }
  }

  if (/\b(?:motor de animaciones|generar (?:videos|animaciones)|crear (?:videos|animaciones)|hacer videos|videos cortos)\b/.test(said) &&
      /^(?:no sabia|no se|sabia|entonces|es verdad|puedes|tienes|me puedes|que capacidad|como funciona|cuentame|explicame)\b/.test(said)) {
    return { kind: 'animation-info' }
  }

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

  // PH-04.2: Two ASUS windows were open while Whisper produced regional and
  // phonetic variations. Distinguish commands, reporting and ambiguous choices
  // BEFORE routing anything to Qwen (which cannot operate this UI).
  const viewContext = /\b(?:vista|vistas|bista|presentacion|version|visual|vision|rostro|cara|cabeza|cuerpo|corrup|corpo|curpo|busto)\b/.test(said)
  const describingFailure = /^(?:indicaste|dijiste|me dijiste|me dijiste que|no cambiaste|sigue siendo|continua siendo|aun se ve|todavia se ve)\b/.test(said)
  if (viewContext && describingFailure) return { kind: 'status' }

  // "Solo quiero probar cambiar ENTRE..." is a request for capabilities,
  // not permission to select either of the two mentioned views.
  const viewInquiry = /^(?:solo\s+)?(?:quiero\s+probar|me\s+gustaria\s+probar|quisiera\s+probar|puedes\s+cambiar\s+entre|quiero\s+saber\s+si\s+(?:puedes|podrias)\s+cambiar|como\s+(?:cambio|cambiar)\s+(?:la\s+)?vista)\b/.test(said)
  if (viewContext && viewInquiry) return { kind: 'list-views' }

  // Recover a stand-alone wake-authorized phrase from Whisper: "Bista solo
  // rostro". This may be treated as a command, but NOT as a command embedded
  // inside a longer discussion or third-party quotation.
  const shorthand = /^(?:vista|bista|version)\s+(?:(?:de|a|la|solo)\s+){0,2}(?:solo\s+rostro|rostro|medio\s+cuerpo|cuerpo\s+intermedio|cuerpo\s+completo|corrup\s+completo)\s*(?:por\s+favor)?$/.test(said)
  const directChange = /^(?:ahora\s+)?(?:por\s+favor\s+)?(?:(?:me\s+)?(?:puedes|podrias|podria)\s+)?(?:cambia|cambio|cambiame|cambiar|cambiarme|cambias|cambies|cambiate|activa|activame|ponte|pon|muestra|muestrate|pasa|pasate|colocate|quiero\s+verte|dejame\s+verte|vuelve|regresa|retorna)\b/.test(said)
  const requestedChange = /^(?:necesito|quiero|quisiera|me\s+gustaria)\s+que\s+(?:(?:me|te)\s+)?(?:cambia|cambias|cambies|cambiaras|cambiar)\b/.test(said)

  if (viewContext && (shorthand || directChange || requestedChange)) {
    const wantsHead = /\b(?:solo\s+(?:(?:el|la|a)\s+)?(?:rostro|cara|cabeza)|solo\s+la\s+cara|la\s+cabeza|el\s+rostro|cara\s+solamente|primer\s+plano)\b/.test(said)
    const wantsFull = /\b(?:cuerpo|corrup|corpo|curpo|preto)\s+(?:completo|entero)\b|\b(?:de\s+pies\s+a\s+cabeza|vista\s+completa)\b/.test(said)
    const wantsBust = /\b(?:medio\s+cuerpo|cuerpo\s+medio|mitad\s+del\s+cuerpo|cuerpo\s+intermedio|vista\s+intermedia|busto)\b/.test(said)
    const wantsDefault = /\b(?:vista\s+principal|vista\s+predeterminada|vista\s+por\s+defecto|vista\s+normal)\b/.test(said)
    const targets = [
      ...(wantsHead ? ['head-vrm'] : []),
      ...(wantsFull ? ['body-vrm'] : []),
      ...(wantsBust ? ['bust-vrm'] : []),
    ] as Array<Exclude<LumiaAvatarView, 'legacy'>>
    // Explicitly named modes take precedence over "vista principal" in
    // statements such as "cambia la vista principal a medio cuerpo".
    // Two explicit destinations are ambiguous and must never trigger a change.
    if (targets.length === 1) return { kind: 'view', view: targets[0] }
    if (targets.length > 1) return { kind: 'list-views' }
    if (wantsDefault) return { kind: 'view', view: 'head-vrm' }
    return { kind: 'list-views' }
  }

  // A request about "visual original" with no unambiguous destination must
  // not fall through to a model that can falsely claim the avatar changed.
  if (viewContext && /^(?:vuelve|regresa|retorna)\b/.test(said)) {
    return { kind: 'list-views' }
  }

  if (/^(?:vuelve|regresa|retorna|deja|deten|para|desactiva)\b/.test(said) &&
    /\b(?:modo natural|modo automatico|animaciones automaticas|animacion automatica|gestos automaticos|movimiento automatico|gestos manuales)\b/.test(said)) {
    return { kind: 'auto' }
  }

  const motions: Array<[RegExp, string]> = [
    [/\b(?:saluda|saludame|saludo|saludar|waving)\b/, 'waving'],
    [/\b(?:aplaude|aplauso|aplausos|aplaudir|clapping)\b/, 'clapping'],
    [/\b(?:beso|besito|lanzar un beso)\b/, 'kiss'],
    [/\b(?:senalamiento directo|senalamiento simple|senalala con un dedo|senala con un dedo|pointing simple)\b/, 'pointing'],
    [/\b(?:senala|senalar|apunta|apuntar|pointing gesture)\b/, 'pointinggesture'],
    [/\b(?:niega|negacion|di que no|gesto de no)\b/, 'no'],
    [/\b(?:pensar|pensando|reflexion|thinking)\b/, 'thinking'],
    [/\b(?:alegria|feliz|happy)\b/, 'happy'],
    [/\b(?:entusiasmo|emocionada|excited)\b/, 'excited'],
    [/\b(?:sorpresa|sorprendida|surprised)\b/, 'surprised'],
    [/\b(?:caminar en sitio|camina en sitio|caminar sin avanzar)\b/, 'walking'],
    [/\b(?:caminar hacia delante|camina hacia delante)\b/, 'walkingforward'],
    [/\b(?:caminar en circulo|paseo circular|walk in circle)\b/, 'walkingcircle'],
    [/\b(?:hablar|conversacion|talking)\b/, 'talking'],
    [/\b(?:reposo|descanso|quieta|idle)\b/, 'idle'],
    [/\b(?:escuchar|escuchando|head gesture)\b/, 'listening'],
    [/\b(?:revisar las manos|revisa tus manos|revisa las manos|unas|nails)\b/, 'nails'],
  ]
  // PH-04.7 — Real owner STT in ASUS, 17:36–17:39:
  // "Muestramiento animación de aplaudir", "quiero ver TU animación",
  // "No lo mismo, lo que quiero es que me muestres la animación...".
  // These are playback requests for an installed asset, never HTML/CSS/video.
  // Require a clear request AND a known catalog motion to avoid accidentally
  // running a clip from a conceptual discussion with Qwen.
  const singleRequest =
    /^(?:(?:mi|lumi|lumia)\s+)?(?:muestramiento|muestrame|mostrame|muestra|ensename|reproduce|ejecuta|quiero\s+ver|quisiera\s+ver|me\s+gustaria\s+ver|(?:me\s+)?puedes\s+(?:mostrar|mostrarme|reproducir)|quiero\s+que\s+(?:me\s+)?muestres|necesito\s+que\s+(?:me\s+)?muestres|no\s+(?:(?:lo\s+)?(?:mismo|mio)|alumnos)\s+lo\s+que\s+quiero\s+es\s+que\s+me\s+muestres)\b/.test(said)
  const actualAnimation = /\b(?:animacion|movimiento|gesto|fbx|motion\s+r8)\b/.test(said)
  if (singleRequest && actualAnimation) {
    for (const [pattern, id] of motions) {
      if (pattern.test(said) && motionIds.has(id)) return {kind:'motion', id}
    }
    // Don't hallucinate or improvise an unknown animation name.
    return {kind:'list-motions'}
  }

  const motionCommand = /^(?:haz|hace|ejecuta|realiza|activa|reproduce|pon|muestra|muestrame|saluda|saludame|aplaude|camina|senala|niega)\b/.test(said)
  if (!motionCommand) return null
  // All 17 catalog IDs are also directly addressable by their exact ID:
  // "Lumi, ejecuta animación pointing", "Lumi reproduce animación walking".
  // Never accept a free-form clip path or URL.
  const exact = said.match(/^(?:ejecuta|reproduce|activa)\s+(?:(?:la|el|una|un)\s+)?(?:animacion|movimiento|gesto)\s+(?:de\s+)?([a-z0-9]+)$/)
  if (exact && motionIds.has(exact[1])) return { kind: 'motion', id: exact[1] }

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

// A tab has its own in-memory React store. Synchronize ONLY approved view
// changes across tabs on this origin. Do not transmit voice, chat, memory,
// animations, user identity or other data. Never echo received events.
const channel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('lumia:ph04-views:v1') : null
function applyLumiaAvatarView(view: LumiaAvatarView, broadcast: boolean): boolean {
  if (!viewKeys.has(view)) return false
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    url.searchParams.set('lumiaAvatar', view)
    url.searchParams.delete('lumiaNeck')
    url.searchParams.delete('lumiaHeadQA')
    window.history.replaceState(window.history.state, '', url.toString())
  }
  if (snapshot.view !== view) {
    snapshot = { ...snapshot, view, sequence: snapshot.sequence + 1 }
    notify()
    if (broadcast) channel?.postMessage({ kind: 'view', view })
  }
  return true
}
channel?.addEventListener('message', (event: MessageEvent) => {
  const message = event.data
  if (!message || message.kind !== 'view' || !viewKeys.has(message.view)) return
  applyLumiaAvatarView(message.view as LumiaAvatarView, false)
})
export function setLumiaAvatarView(view: LumiaAvatarView): boolean {
  return applyLumiaAvatarView(view, true)
}

export function requestLumiaAvatarMotion(id: string): boolean {
  if (!motionIds.has(id)) return false
  if (snapshot.view === 'legacy' || snapshot.view === 'head-vrm') {
    // Legs must be visible for a full-body walking command; all other
    // gesture requests use the established middle-body showcase.
    const clip = motionCatalog.find((item) => item.id === id)
    setLumiaAvatarView(clip?.fullBody ? 'body-vrm' : 'bust-vrm')
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
  if (action.kind === 'animation-info') {
    return 'Tengo un motor de reproducción Motion R8 integrado en mi avatar virtual: puedo mostrar diecisiete clips FBX locales y expresiones faciales compatibles. Eso no significa que pueda crear videos nuevos o generar nuevas animaciones por IA en esta instalación. El análisis de imágenes es una capacidad distinta y requiere un modelo visual compatible y una imagen proporcionada por ti.'
  }
  if (action.kind === 'demo') {
    return 'Puedo ofrecerte una demostración guiada de mis diecisiete movimientos Motion R8 y de mis expresiones faciales, si los archivos están disponibles.'
  }
  if (action.kind === 'demo-stop') {
    return 'He detenido mi demostración y regresado al movimiento automático.'
  }
  if (action.kind === 'auto') {
    resumeLumiaAvatarMotion()
    return 'He vuelto al modo de movimientos automáticos de Motion R8.'
  }
  if (action.kind === 'status') {
    return 'En esta ventana mi presentación actual es ' +
      avatarViewLabel(avatarPresenceSnapshot().view) +
      '. No he cambiado nada con esa frase. Si quieres otra vista, dime cuál: solo rostro, medio cuerpo o cuerpo completo.'
  }
  if (action.kind === 'list-views') {
    return 'Sí, tengo tres vistas: solo rostro, medio cuerpo y cuerpo completo. Mi presentación habitual es solo rostro, centrada en los aros. También puedo mostrar mi cuerpo animado con Motion R8 en medio cuerpo o cuerpo completo. Dime cuál quieres que active.'
  }
  if (action.kind === 'list-motions') {
    const shortList = motionCatalog.map((item) => item.label)
    return 'Tengo un catálogo de diecisiete animaciones Motion R8: ' +
      shortList.join(', ') +
      '. Para ejecutarlas necesito que sus archivos estén instalados y sean compatibles con el avatar.'
  }
  return 'Mi presencia habitual es solo rostro, para que se vean bien mis ojos y expresiones. Como avatar virtual, también puedo mostrar medio cuerpo y cuerpo completo con un catálogo de diecisiete animaciones Motion R8. Los gestos acompañan mi conversación y puedo intentar un movimiento cuando me lo pidas, si su archivo local es compatible.'
}
