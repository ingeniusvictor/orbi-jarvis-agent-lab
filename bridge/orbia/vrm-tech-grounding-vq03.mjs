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

export const VRM_TECH_SYSTEM_HINT_VQ03=
  '\n[VQ-03 / precisión de términos para esta respuesta: VRM se refiere a un '+
  'avatar humanoide 3D con rig, huesos y expresiones; VRAM es memoria gráfica '+
  'de la GPU. Si el STT produjo "un VRAM" en un contexto de animación de avatares, '+
  'probablemente el usuario quiso decir VRM. Para una IA local como sistema '+
  'nervioso de un avatar, explica IA de alto nivel → controlador de estados '+
  'y transiciones → reproductor/mezclador de clips Motion R8, IK y visemas '+
  'del rig. No inventes acceso al PC ni acciones. Responde en español breve.]'

export function technicalVrmSystemHint(prompt){
  return isTechnicalVrmQuestion(prompt)?VRM_TECH_SYSTEM_HINT_VQ03:''
}
