/**
 * AMR-02.6 — non-identifying, session-only visual tracing metadata.
 * No hash/fingerprint of the picture; never records file paths, pixels, prompt
 * or original bytes. One random photo ID survives follow-up of the SAME JPEG;
 * each model question gets its own independent turn ID from App.tsx.
 */
export type VisionTraceSource='file'|'camera'
export type VisionTraceRole='new'|'followup'|'reanalysis'
export type VisionTraceMetadata={
  photoId:string
  source:VisionTraceSource
  limitPx:512|768|1024
  width:number
  height:number
  encodedChars:number
  turnId?:string
  role?:VisionTraceRole
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
