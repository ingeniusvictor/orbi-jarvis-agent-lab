/**
 * VI-03.2B — spoken requests for a FRESH camera observation.
 *
 * Matches constrained scene references, including verified Whisper mishearings.
 * Does not open webcam, infer people/identities or invent any frame.
 */
const normalize=(input:string):string=>String(input??'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ')
  .replace(/\s+/g,' ').trim()
  .replace(/^(?:(?:hola|oye|hey|ok|okay)\s+)?(?:lumi|lumia|lumi a|jarvis)\s+/,'')
  .replace(/\s+(?:lumi|lumia|jarvis)$/,'')
  .trim()

export type CameraSpeechIntent='fresh-scene'|'visual-correction'|'none'

const nonScene=/\b(?:codigo|github|ollama|internet|receta|clima|noticias|calendario|musica|correo|precio|reunion|aplicacion|proyecto)\b/
const oldPhoto=/\b(?:foto anterior|fotografia anterior|imagen anterior|en aquella foto|en esa foto de antes|la foto que vimos antes)\b/

export function classifyFreshCameraSpeech(value:string):CameraSpeechIntent{
  const q=normalize(value)
  if(!q || q.length>330 || nonScene.test(q) || oldPhoto.test(q))return 'none'

  if(/(?:no (?:logras|puedes|alcanzas) (?:verlo|verla|ver|distinguir)|por que no (?:lo|la) ves|revisa(?:r)? nuevamente|vuelve a revisar|mira de nuevo)/.test(q)
      && /\b(?:camara|imagen|fotograma|escena|frente|hijo|hija|nino|nina|persona|personas|ver|viendo|ves)\b/.test(q))
    return 'visual-correction'

  if(/(?:este|esta|aqui|frente a (?:ti|la camara))\b.*\b(?:mi hijo|mi hija|nino|nina|dos personas|otra persona)\b/.test(q)
      && /\b(?:camara|imagen|fotograma|viendo|mira|ver|ves|frente)\b/.test(q))
    return 'visual-correction'

  // Whisper sometimes drops /v/ in "¿qué ves ahora?" or outputs
  // "ahora que veas Lumia". This correction is for camera-session routing
  // only, NOT a global rewrite of all user speech.
  if(/^(?:(?:y|pero)\s+)?(?:ahora\s+)?(?:que (?:ves|veas|estas viendo|esta viendo|esta viendo ahora|mas estas viendo|mas ves|hay delante|hay frente a la camara)(?:\s+ahora)?|y ahora que ves|ahora que ves|que es ahora)$/.test(q))
    return 'fresh-scene'

  if(/^(?:(?:y|pero)\s+)?(?:que(?:\s+mas)? (?:estas viendo|esta viendo|ves|observas)(?:\s+ahora)?|que (?:ves|estas viendo|esta viendo) (?:en la camara|frente a ti|ahi|aqui)|que hay (?:ahora|delante de la camara|en la camara)|mira (?:ahora|aqui|de nuevo)|observa (?:ahora|esto)|describe (?:lo que ves|la escena actual)|que (?:persona|personas|nino|ninos|objetos|objeto) (?:ves|hay|aparecen)(?: ahora)?)(?:\s+.*)?$/.test(q))
    return 'fresh-scene'

  return 'none'
}

export function freshCameraScenePrompt(question:string,correction:boolean):string{
  const reference=correction
    ? ' El usuario ha indicado que puede haber otra persona, incluido un menor, frente a la cámara. Esta indicación NO prueba que sea visible: inspecciona el fotograma actual y no confirmes ni descartes figuras sin evidencia. '
    : ' '
  return 'Describe solamente el fotograma NUEVO adjunto, no el historial de conversación. '+
    'Primero revisa todo el encuadre y cuenta las figuras humanas realmente visibles, incluidas las parcialmente ocultas. '+
    'Indica su posición (izquierda, derecha, fondo, primer plano) sin atribuir identidades, parentescos ni edades exactas. '+
    'Después describe solo prendas y objetos que puedas comprobar; una camiseta con logo NASA NO implica uniforme de astronauta. '+
    'Si falta nitidez o parte del cuerpo está fuera del encuadre, dilo explícitamente. '+
    'No inventes uniformes, chalecos, rostros ni movimientos. '+
    'No afirmes que la escena está vacía o sin cambios si solo tienes un fotograma. '+
    reference+'Pregunta del usuario: '+question.trim()
}
