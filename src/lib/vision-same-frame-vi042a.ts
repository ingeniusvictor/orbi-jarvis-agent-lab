/**
 * VI-04.2A — diagnostic result from the EXACT JPEG sent to Qwen.
 * A facial detector counts visible faces, not all people, and cannot
 * identify anyone. Never keep pixels or add this count to an LLM prompt.
 */
import {FACE_DETECTOR_MAX_RESULTS} from './vision-faces-vi04'

export const SAME_FRAME_AUDIT_TIMEOUT_MS=850

export type SameFrameFaceStatus=
  'matched'|'detector-off'|'detector-unavailable'|'timeout'|'cancelled'|'error'

export type SameFrameFaceEvidence={
  captureId:string
  status:SameFrameFaceStatus
  faceCount:number|null
  inferenceMs:number|null
  sameJpeg:boolean
  facesArePeople:false
}

export function makeSameFrameFaceEvidence(
  captureId:string,
  status:SameFrameFaceStatus,
  count:number|null=null,
  inferenceMs:number|null=null,
):SameFrameFaceEvidence{
  if(!captureId || captureId.length>96)throw Error('Invalid ephemeral vision capture ID')
  const validCount=Number.isInteger(count) && count!==null &&
    count>=0 && count<=FACE_DETECTOR_MAX_RESULTS
  const matched=status==='matched' && validCount
  const safeStatus:SameFrameFaceStatus=status==='matched' && !matched?'error':status
  return {
    captureId,
    status:safeStatus,
    faceCount:matched?count:null,
    inferenceMs:matched && inferenceMs!==null &&
      Number.isFinite(inferenceMs) && inferenceMs>=0
      ? Math.round(inferenceMs):null,
    sameJpeg:matched,
    facesArePeople:false,
  }
}

/** Immutable, image-free observability payload for one authorized turn. */
export function sameFrameLog(evidence:SameFrameFaceEvidence,frameAgeMs:number|null){
  const age=frameAgeMs!==null&&Number.isFinite(frameAgeMs)&&frameAgeMs>=0
    ? Math.round(frameAgeMs):null
  return {...evidence,frameAgeMs:age}
}
