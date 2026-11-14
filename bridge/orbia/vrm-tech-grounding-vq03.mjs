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
  // 14-Nov ASUS: Whisper heard "avatar BRM". The avatar context is strong
  // but not sufficient to silently rewrite a named acronym in the transcript.
  if(/\bavatar\s+brm\b/.test(said) && bareDefinition && !hardware){
    return 'Whisper entendió BRM. ¿Querías decir VRM, el formato de avatar humanoide 3D?'
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

/**
 * Keep grounded advice distinct: WHAT TO IMPROVE (smooth animation) is not
 * HOW TO CONTROL it WHILE CONVERSING (state/event orchestration). These
 * are hints only; the model still answers the owner's original user text.
 */
export function avatarAnimationAdviceFocus(prompt){
  if(!isConversationalAvatarAnimationQuestion(prompt))return null
  const said=fold(prompt)
  if(/\b(?:controlar|sincronizar|coordinar)\b/.test(said) &&
      /\b(?:conversamos|conversacion|hablamos|dialogo)\b/.test(said)){
    return 'conversation-control'
  }
  return 'motion-naturalness'
}

export function isVq03UnreliableAvatarAdvice({prompt,answer,history=[]}={}){
  const focus=avatarAnimationAdviceFocus(prompt)
  if(!focus)return false
  const text=fold(answer)
  // The app has no verified function to simulate/edit its blend graphs
  // merely because Qwen says "want to try it now?".
  if(/\b(?:quieres|gustaria|podemos)\b.{0,90}\b(?:probar|simular|simulacion|ajustar)\b.{0,90}\b(?:ahora|mismo|en vivo)\b/.test(text))return true
  if(focus==='conversation-control'){
    const hasStateController=/\b(?:estado|estados|escucha|escuchando|pienso|pensamiento|habla|hablando|reposo|gesto|gestos|evento|eventos|visema|visemas|sincronizar|sincronizacion|reaccionar|reaccion)\b/.test(text)
    if(!hasStateController && /\b(?:tiempos|transicion|transiciones|interpolacion|suavizar)\b/.test(text))return true
    // Detect a near-repeat of an older answer when the user deliberately
    // changed from "naturalidad" to "control mientras conversamos".
    const prev=history.filter(e=>e?.role==='assistant').slice(-2).map(e=>fold(e.content))
    const recurring=/\b(?:ajustar los tiempos de transicion|sincronizar mejor los cambios de visor)\b/.test(text)
    if(recurring && prev.some(p=>p.includes('ajustar los tiempos de transicion')&&
         p.includes('sincronizar mejor los cambios de visor')))return true
  }
  return false
}

export function vq03AdviceSystemHint(prompt){
  const focus=avatarAnimationAdviceFocus(prompt)
  if(!focus)return ''
  const base='\\n[VQ-03.5 / hechos verificados: Motor Motion R8 y vistas VRM disponibles; no existe evidencia de controles de simulación de ajustes automáticos en esta sesión. '+
    'No ofrezcas probar una simulación inmediata ni afirmes haber modificado interpolación, tiempos o rig. Indica las mejoras como propuestas técnicas.]'
  return focus==='conversation-control'
    ? base+'\\n[VQ-03.5 / pregunta ACTUAL sobre CONTROL mientras conversa: explica un controlador por eventos que cambie estado escucha → pensamiento → habla → reposo, selección acotada de Motion R8, prioridad de gesto, mezcla con visemas y sincronización TTS. No repitas consejos genéricos de suavizado de la pregunta anterior.]'
    : base+'\\n[VQ-03.5 / pregunta ACTUAL sobre NATURALIDAD: explica mezclado de clips, interpolación, gestos pequeños, mirada y respiración, sin prometer funciones actualmente no implementadas.]'
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
  if(isConversationalAvatarAnimationQuestion(prompt))return VRM_CONVERSATION_SYSTEM_HINT_VQ034+vq03AdviceSystemHint(prompt)
  return ''
}
