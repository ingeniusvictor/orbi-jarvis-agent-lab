/**
 * VI-04.2B (pilot): a conservative, camera-authorized single-JPEG visual
 * instruction. Avoid suggesting people behind/in the background or invented
 * lettering. CPU face evidence is advisory: a face is NOT a person count.
 *
 * No data storage, camera access, model switching, extra inference or reply
 * rewriting. Guarded by NEXT-only VITE flag, never enabled in daily ASUS.
 */
import type {SameFrameFaceEvidence} from './vision-same-frame-vi042a'

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
  return 'Observa solo el JPEG NUEVO adjunto, no recuerdos de otra imagen. '+
    'Es un único instante, no un vídeo: no deduzcas movimientos ni acumules posiciones anteriores de alguien. '+
    'Cuenta únicamente figuras humanas que se distingan individualmente por evidencia visible en ESTE encuadre. '+
    'No supongas personas al fondo ni detrás de alguien si no se pueden distinguir. '+
    'No fuerces un número: si el conteo es ambiguo, explica el límite con brevedad. '+
    'Describe posiciones, vestimenta y texto de prendas solo si se ven con claridad; '+
    'no inventes nombres de marcas, palabras impresas ni detalles que no puedes leer. '+
    caution+groundedFaceCountHint(evidence)+
    'Pregunta del usuario: '+question.trim()
}
