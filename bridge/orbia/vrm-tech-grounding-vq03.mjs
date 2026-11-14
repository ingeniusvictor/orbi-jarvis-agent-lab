/**
 * VQ-03.1 — Backend-only, read-only SYSTEM-level grounding.
 *
 * Keep the human's EXACT question in the user turn. The earlier frontend
 * implementation appended a VRM/VRAM hint to msg.text. SKILL-01 then saw
 * "memoria" in that hint and intercepted an unrelated technical question with
 * an instant but incorrect MEM-01 boilerplate reply.
 *
 * No user prompt rewriting, voice changes, camera actions or extra model calls.
 */
const fold=value=>String(value??'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()

export function isTechnicalVrmQuestion(text){
  const said=fold(text)
  const vrmMention=/\bvrm\b/.test(said)
  const possibleSttVrm=/\bvram\b/.test(said) &&
    /\b(?:avatar|animacion|animaciones|animar|animado|animada|hueso|huesos|esqueleto|rig|rigging|fbx|blendshape|expresiones|modelo 3d|sistema nervioso)\b/.test(said)
  if(!vrmMention&&!possibleSttVrm)return false
  if(!vrmMention &&
    /\b(?:gpu|tarjeta grafica|memoria grafica|memoria de video|gb de vram|vram dedicada|nvidia)\b/.test(said))return false
  return /\b(?:que|como|si|quisiera|queremos|podemos|podria|necesito|necesitaria|explica|explicame|disenar|crear|construir|desarrollar|funciona|funcionan|controlara|controlar|hacer|conseguir|convertir)\b/.test(said)
}

/**
 * VQ-03.4 — If Whisper says "un VRAM" in a bare definition question,
 * VRM (3D avatar) and VRAM (graphics memory) cannot be reliably separated.
 * Clarify instead of silently relabelling a hardware question.
 *
 * A malformed STT transcript "animaciones para que esperan de manera natural"
 * is not a request to add delays. Ask whether the owner meant natural motion.
 * Do not mutate STT, OS, model, prompt history or device controls.
 */
export function clarifyVq03AmbiguousTechnicalSpeech(prompt){
  const said=fold(prompt)
  const hardware=/\b(?:gpu|tarjeta grafica|memoria grafica|memoria de video|video dedicada|vram dedicada|gigas|gigabytes|\d+\s*gb|nvidia)\b/.test(said)
  const avatar=/\b(?:avatar|vrm|rigging|rig|huesos|esqueleto|motion r8|modelo 3d)\b/.test(said)
  const bareDefinition=/\b(?:que es|que significa|define|explicame|explica)\b/.test(said)
  const asMasculineVram=/\bun\s+vram\b/.test(said)
  if(asMasculineVram && bareDefinition && !hardware && !avatar){
    return '¿Te refieres a VRM, el formato de avatares 3D, o a VRAM, la memoria gráfica de una GPU?'
  }
  const mangledNaturalMotion=/\banimaciones\b/.test(said) &&
    /\bpara\s+que\s+esperan\b/.test(said) &&
    /\b(?:natural|naturales)\b/.test(said)
  if(mangledNaturalMotion){
    return '¿Quieres decir cómo hacer que mis animaciones se vean y se muevan de manera más natural?'
  }
  return null
}

export function isConversationalAvatarAnimationQuestion(prompt){
  const said=fold(prompt)
  return /\b(?:tus|mis)\s+(?:animaciones|gestos|movimientos)\b/.test(said) &&
    /\b(?:mejorar|natural|naturales|conversamos|conversacion|controlar|sincronizar|fluida|fluidas)\b/.test(said) &&
    !/\b(?:gpu|memoria grafica|vram dedicada)\b/.test(said)
}

export const VRM_CONVERSATION_SYSTEM_HINT_VQ034=
  '\n[VQ-03.4 / conversación y avatar: responde sobre el rig VRM y el '+
  'control real de estados de conversación (escucha, pensamiento, habla, '+
  'reposo), Motion R8, transiciones, mezclas de clips y visemas. '+
  'No afirmes que existen comandos de usuario pause/resume, herramientas '+
  'ni control autónomo de huesos si el código no los ha validado. '+
  'Presenta las funciones no implementadas como propuestas, no hechos.]'

export const VRM_TECH_SYSTEM_HINT_VQ03=
  '\n[VQ-03 / precisión de términos para esta respuesta: VRM se refiere a un '+
  'avatar humanoide 3D con rig, huesos y expresiones; VRAM es memoria gráfica '+
  'de la GPU. Si el STT produjo "un VRAM" en un contexto de animación de avatares, '+
  'probablemente el usuario quiso decir VRM. Para una IA local como sistema '+
  'nervioso de un avatar, explica IA de alto nivel → controlador de estados '+
  'y transiciones → reproductor/mezclador de clips Motion R8, IK y visemas '+
  'del rig. No inventes acceso al PC ni acciones. Responde en español breve.]'

export function technicalVrmSystemHint(prompt){
  if(isTechnicalVrmQuestion(prompt))return VRM_TECH_SYSTEM_HINT_VQ03
  if(isConversationalAvatarAnimationQuestion(prompt))return VRM_CONVERSATION_SYSTEM_HINT_VQ034
  return ''
}
