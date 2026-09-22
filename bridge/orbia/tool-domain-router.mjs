/**
 * L7 Tool Domain Router.
 *
 * Deterministic first-pass scoping for small/local models. The router does not
 * execute tools and does not grant permissions. It only says which capability
 * domains appear relevant to the user's request so a later registry can expose
 * a smaller schema set to Qwen.
 */

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export const TOOL_DOMAINS = Object.freeze([
  'voice',
  'system',
  'files',
  'web',
  'calendar',
  'mail',
  'vision',
  'browser',
  'media',
  'home',
  'code',
  'research',
])

const RULES = Object.freeze([
  ['voice', /\b(?:voz|microfono|micro|whisper|kokoro|lumi|lumia|wake word|despierta|escucha)\b/],
  ['system', /\b(?:cpu|gpu|ram|memoria|bateria|sistema|equipo|pc|computador|ordenador|aplicacion|app|programa|proceso)\b/],
  ['files', /\b(?:archivo|archivos|carpeta|directorio|documento|pdf|excel|csv|drive|fichero)\b/],
  ['web', /\b(?:web|internet|busca|buscar|investiga|investigar|noticia|noticias|sitio|pagina web)\b/],
  ['calendar', /\b(?:agenda|calendario|evento|eventos|reunion|reuniones|cita|citas|recordatorio)\b/],
  ['mail', /\b(?:correo|correos|email|emails|gmail|bandeja|mensaje de correo)\b/],
  ['vision', /\b(?:pantalla|captura|imagen|foto|camara|mira|observa|lee este error|que ves)\b/],
  ['browser', /\b(?:navegador|chrome|pestana|pestanas|tab|tabs|sitio abierto|pagina abierta|haz clic|clic|formulario)\b/],
  ['media', /\b(?:musica|spotify|youtube|video|pelicula|serie|pausa|reproduce|volumen|cancion)\b/],
  ['home', /\b(?:luz|luces|enchufe|casa|habitacion|sala|cocina|domotica|hue|alexa|google home)\b/],
  ['code', /\b(?:codigo|programa|programar|typescript|javascript|python|repo|repositorio|git|github|bug|debug|compila|build)\b/],
  ['research', /\b(?:compara|comparar|analiza|analizar|investigacion|profundidad|estudio|arquitectura|estrategia)\b/],
])

const CASUAL =
  /^(?:hola|buenos dias|buenas tardes|buenas noches|gracias|como estas|que tal|quien eres)[?.!\s]*$/

const ACTION =
  /\b(?:abre|cierra|crea|borra|elimina|cambia|modifica|envia|manda|instala|ejecuta|enciende|apaga|sube|baja|publica|reserva|compra|paga|descarga)\b/

export function selectToolDomains(prompt) {
  const raw = String(prompt ?? '').trim()
  const text = normalize(raw)

  if (!text) {
    return Object.freeze({
      mode: 'none',
      domains: Object.freeze([]),
      reason: 'empty',
    })
  }

  if (CASUAL.test(text)) {
    return Object.freeze({
      mode: 'scoped',
      domains: Object.freeze([]),
      reason: 'casual-conversation',
    })
  }

  const domains = []
  for (const [domain, pattern] of RULES) {
    if (pattern.test(text)) domains.push(domain)
  }

  // Browser interaction implies browser + vision more often than not, while
  // research implies web unless the request names an already-local source.
  if (domains.includes('browser') && !domains.includes('vision')) {
    domains.push('vision')
  }
  if (domains.includes('research') && !domains.includes('web')) {
    domains.push('web')
  }

  if (domains.length) {
    return Object.freeze({
      mode: 'scoped',
      domains: Object.freeze([...new Set(domains)]),
      reason: 'domain-match',
    })
  }

  // Unknown action requests keep the full catalogue in the future registry.
  // A deterministic router must never hide the one tool needed for an intent
  // it does not understand.
  if (ACTION.test(text)) {
    return Object.freeze({
      mode: 'full',
      domains: null,
      reason: 'unknown-action',
    })
  }

  return Object.freeze({
    mode: 'scoped',
    domains: Object.freeze([]),
    reason: 'conversation-no-tools',
  })
}
