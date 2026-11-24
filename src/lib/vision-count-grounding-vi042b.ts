/**
 * VI-04.2B (pilot): a conservative, camera-authorized single-JPEG visual
 * instruction. Avoid suggesting people behind/in the background or invented
 * lettering. CPU face evidence is advisory: a face is NOT a person count.
 *
 * No data storage, camera access, model switching, extra inference or reply
 * rewriting. Guarded by NEXT-only VITE flag, never enabled in daily ASUS.
 */
import type {SameFrameFaceEvidence} from './vision-same-frame-vi042a'

// VI-04.2B.3: protect owner-validated person counting while allowing body
// questions to use the same broader visual capability as "Analizar ahora".
// Classification reads ONLY the explicit user question (never a JPEG).
const normalizeFocusQuestion=(value:string):string=>String(value??'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ')
  .replace(/\s+/g,' ').trim()

export type VisualQuestionFocus='people-count'|'body-posture'|'general'

export function classifyVisualQuestionFocus(question:string):VisualQuestionFocus{
  const q=normalizeFocusQuestion(question)
  // Explicit person-count requests always retain the already-tested B.1/B.2
  // same-JPEG CPU evidence, even if the question also mentions actions.
  if(/\b(?:cuant[oa]s?|numero de|cantidad de|total de)\s+(?:personas?|gente|rostros?|caras?|figuras?\s+humanas?)\b/.test(q)||
    /\b(?:cuenta|contar|cuentas)\s+(?:(?:las|los)\s+)?(?:personas?|rostros?|caras?)\b/.test(q))
    return 'people-count'
  if(/\b(?:brazos?|manos?|dedos?|hombros?|torso|cuerpo|piernas?|rodillas?|postura|pose|gesto|gestos|levantad[oa]s?|sentad[oa]s?|agachad[oa]s?|sosteniendo|sostengo)\b/.test(q))
    return 'body-posture'
  return 'general'
}

export function groundedFaceCountHint(evidence:SameFrameFaceEvidence|undefined|null):string{
  if(!evidence || evidence.status!=='matched' || !evidence.sameJpeg ||
    evidence.faceCount===null || !Number.isInteger(evidence.faceCount) ||
    evidence.faceCount<0 || evidence.faceCount>8)return ''
  const faces=evidence.faceCount
  const noun=faces===1?'rostro visible':'rostros visibles'
  return ' En una comprobación CPU de EXACTAMENTE este mismo JPEG se detectaron '+
    faces+' '+noun+'. '+ 
    'Ese resultado solo indica rostros reconocibles por el detector; '+
    'no confirma el total de personas (puede haber personas de espaldas, parcialmente ocultas o rostros no detectados). '+
    'Úsalo solo como contraste: no añadas otras figuras humanas sin distinguir claramente su contorno en la fotografía. '+
    'Si crees ver más personas que rostros, explica qué evidencia visual independiente permite contarlas; '+
    'si la evidencia es insuficiente, expresa incertidumbre sobre el total, sin inventar personas ni posiciones. '
}

export function groundedFreshScenePrompt(
  question:string,
  correction:boolean,
  evidence:SameFrameFaceEvidence|undefined|null,
):string{
  const caution=correction
    ? 'El usuario cuestionó una descripción anterior: reconsidera la imagen actual sin adoptar su afirmación como evidencia. '
    : ''
  // A/B ASUS 2026-11-21: Qwen 2B saw the raised arm via "Analizar ahora",
  // but answered "1 rostro" on the general chat. For explicit arm/torso
  // questions, suppress face-count priming, NOT the same-JPEG CPU audit.
  // The count/general branches below retain the accepted prompt byte-for-byte.
  if(classifyVisualQuestionFocus(question)==='body-posture'){
    return 'Observa solamente el JPEG NUEVO adjunto y examina TODO el encuadre, no solo el rostro. '+
      'La pregunta trata de cuerpo o postura: revisa cabeza, hombros, torso, brazos y manos, '+
      'pero describe únicamente las partes que realmente aparecen. '+
      'Si se pregunta si hay un brazo levantado, responde sí, no o no se distingue según la imagen; '+
      'no des por supuesto que lo hay ni que no lo hay. '+
      'Si se ve, explica brevemente la posición; no confundas una foto inmóvil con evidencia de movimiento. '+
      'No conviertas el número de rostros detectados en respuesta a una pregunta sobre brazos o cuerpo. '+
      'No inventes objetos, posiciones, prendas ni acciones. '+
      'Responde directamente en una o dos frases naturales; si algo no se ve, indica solo esa limitación. '+
      caution+'Pregunta del usuario: '+question.trim()
  }
  return 'Observa solo el JPEG NUEVO adjunto, no recuerdos de otra imagen. '+
    'Es un único instante, no un vídeo: no deduzcas movimientos ni acumules posiciones anteriores de alguien. '+
    'Cuenta únicamente figuras humanas que se distingan individualmente por evidencia visible en ESTE encuadre. '+
    'No supongas personas al fondo ni detrás de alguien si no se pueden distinguir. '+
    'No fuerces un número: si el conteo es ambiguo, explica el límite con brevedad. '+
    'Describe posiciones, vestimenta y texto de prendas solo si se ven con claridad; '+
    'no inventes nombres de marcas, palabras impresas ni detalles que no puedes leer. '+
    // VI-04.2B.2: keep the already-approved face evidence/count guidance
    // unchanged. Improve wording, observable actions and current position only.
    'Responde primero cuántas personas puedes distinguir con fundamento visual; '+
    'si solo se aprecia un rostro y no el cuerpo, informa el rostro visible sin inventar más personas. '+
    'Después responde qué están haciendo SOLO si la postura o actividad se ve en este fotograma: '+
    'por ejemplo sentado, de pie, mirando la cámara o sosteniendo algo, cuando sea comprobable. '+
    'Un rostro aislado no demuestra si la persona está sentada, caminando, hablando o moviéndose. '+
    'Si no puedes determinar la acción, di brevemente que no se distingue qué hace. '+
    'Usa izquierda, centro, derecha, delante o detrás únicamente si corresponden a la imagen ACTUAL; '+
    'no supongas que está al centro ni recuerdes posiciones anteriores. '+
    'Contesta en una o dos frases naturales y claras. Evita explicaciones repetitivas como '+
    '"certeza absoluta", "no puedo contar más" o "no hay otros objetos", salvo si son esenciales. '+
    caution+groundedFaceCountHint(evidence)+
    'Pregunta del usuario: '+question.trim()
}
