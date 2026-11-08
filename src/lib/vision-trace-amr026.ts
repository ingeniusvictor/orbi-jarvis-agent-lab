/**
 * AMR-02.6 — non-identifying, session-only visual tracing metadata.
 * No hash/fingerprint of the picture; never records file paths, pixels, prompt
 * or original bytes. One random photo ID survives follow-up of the SAME JPEG;
 * each model question gets its own independent turn ID from App.tsx.
 */
export type VisionTraceSource='file'|'camera'
export type VisionTraceRole='new'|'followup'|'reanalysis'
export type VisionTraceIntent='count'|'ocr'|'scene'
export type VisionTraceMetadata={
  photoId:string
  source:VisionTraceSource
  limitPx:512|768|1024
  width:number
  height:number
  encodedChars:number
  turnId?:string
  role?:VisionTraceRole
  intent?:VisionTraceIntent
}

export function createVisionTrace(source:VisionTraceSource,limitPx:512|768|1024,width:number,height:number,encodedChars:number):VisionTraceMetadata{
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1024||height>1024||
    !Number.isInteger(encodedChars)||encodedChars<4||encodedChars>2_000_000)
    throw new Error('Dimensiones visuales inválidas para diagnóstico.')
  const nonce=globalThis.crypto?.randomUUID?.() ??
    (Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14))
  return {photoId:'p'+nonce,source,limitPx,width,height,encodedChars}
}

export const visionTracingEnabled=()=>import.meta.env?.VITE_LUMIA_VISION_TRACE_AMR026==='1'

export function visionTraceSummary(trace:VisionTraceMetadata):string{
  return `photo=${trace.photoId} source=${trace.source} edge=${trace.limitPx}px actual=${trace.width}x${trace.height} encodedChars=${trace.encodedChars}`
}

/** Short, task-specific visual quality instructions; never a second model call. */
export function visualPrecisionInstruction(question:string):string{
  const q=String(question??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  if(/\b(?:cuantos|cuantas|contar|cuenta|conteo|cantidad|numero de personas|total de personas)\b/.test(q))
    return ' Antes de afirmar un total, recorre visualmente las figuras de izquierda a derecha una sola vez; no confundas figuras con sus reflejos. Si hay oclusiones o dudas sobre posturas, indícalo en vez de inventar cifras. '
  if(/\b(?:lee|leer|lectura|texto|letras|etiqueta|placa|documento|transcribe|numero de serie|logo|marca)\b/.test(q))
    return ' Transcribe solamente caracteres directamente visibles en el JPEG. No conviertas una marca reconocible por su diseño en letras supuestamente leídas; si unas letras son legibles y otras no, distingue ambas partes. '
  return ''
}

/** Only classify the actual spoken/written question, never the prompt with
 * instructions; the latter contains counting terms even for ordinary scenes. */
export function visualTraceIntent(question:string):VisionTraceIntent{
  const q=String(question??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  if(/\b(?:lee|leer|lectura|texto|letras|etiqueta|placa|documento|transcribe|numero de serie|marca|logo|que dice|que pone)\b/.test(q))
    return 'ocr'
  if(/\b(?:cuantos|cuantas|contar|cuenta|conteo|cantidad|numero de personas|total de personas)\b/.test(q))
    return 'count'
  return 'scene'
}
