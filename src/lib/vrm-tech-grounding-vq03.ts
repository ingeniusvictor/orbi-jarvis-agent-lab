/**
 * VQ-03 — bounded, read-only grounding for technical avatar-VRM questions.
 *
 * Whisper sometimes produces "un VRAM" for a 3D-avatar "un VRM".
 * Preserve the original transcription and all user-visible logs; only append
 * scoped, static terminology to the GENERATIVE path, never gesture commands.
 * No model calls, GPU changes, microphone, files, camera or tool permissions.
 */
const fold=(text:string)=>String(text??'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()

export function isTechnicalVrmQuestion(text:string):boolean{
  const said=fold(text)
  const vrmMention=/\bvrm\b/.test(said)
  const possibleSttVrm=/\bvram\b/.test(said) &&
    /\b(?:avatar|animacion|animaciones|animar|animado|animada|hueso|huesos|esqueleto|rig|rigging|fbx|blendshape|expresiones|modelo 3d|sistema nervioso)\b/.test(said)
  if(!vrmMention&&!possibleSttVrm)return false
  // Don't reinterpret explicit hardware / GPU-memory questions as VRM.
  if(!vrmMention &&
    /\b(?:gpu|tarjeta grafica|memoria grafica|memoria de video|gb de vram|vram dedicada|nvidia)\b/.test(said))return false
  // Only technical questions, not "mueve el VRM", "ejecuta animacion" etc.
  return /\b(?:que|como|si|quisiera|queremos|podemos|podria|necesito|necesitaria|explica|explicame|disenar|crear|construir|desarrollar|funciona|funcionan|controlara|controlar|hacer)\b/.test(said)
}

export const VRM_TECH_HINT_VQ03=
  'Aclaración contextual: VRM es un avatar humanoide 3D con rig, huesos y expresiones; '+
  'VRAM es memoria de la GPU. Si el reconocimiento de voz dijo "un VRAM" al hablar '+
  'de animar un personaje, probablemente quiso decir "un VRM". '+
  'Para un sistema nervioso local, explica una arquitectura concreta: IA interpreta '+
  'intención y estado, un controlador validado selecciona/mezcla clips, transiciones, '+
  'IK y expresiones del rig VRM. No atribuyas control real de archivos o del PC '+
  'sin que exista una herramienta autorizada. Responde en español con pasos breves.'

export function withVrmTechnicalContext(text:string):string{
  return isTechnicalVrmQuestion(text)
    ? text+'\n\n[Información técnica local, no es una nueva petición del usuario: '+
      VRM_TECH_HINT_VQ03+']'
    : text
}
