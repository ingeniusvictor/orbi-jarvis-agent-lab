/**
 * VI-04.1 — read-only correlation between an owner-authorized fresh camera
 * snapshot and CPU FACE PRESENCE data from the same viewfinder.
 *
 * Reports ONLY timestamps, ages and face count. A face is not a person count:
 * no identity, relation, age, tracking, recognition or model instructions.
 * Never opens camera, queries a model, stores images or changes any reply.
 */
import {FACE_DETECTOR_MAX_RESULTS,FACE_DETECTOR_STALE_MS} from './vision-faces-vi04'

export const AUDIT_CURRENT_FRAME_MAX_AGE_MS=2_000

export type VisionFaceSample={
  count:number
  observedAt:number
}
export type VisionAuditStatus=
  'camera-not-authorized'|'no-current-frame'|'frame-aged'|
  'face-detector-off'|'face-detector-unavailable'|
  'face-detector-stale'|'face-presence-available'

export type VisionAuditResult={
  status:VisionAuditStatus
  frameAgeMs:number|null
  faceCount:number|null
  faceSampleAgeAtCaptureMs:number|null
  faceEvidenceIsIdentity:false
  cameraAutoOpened:false
}

const validAge=(later:number,earlier:number):number|null=>{
  if(!Number.isFinite(later)||!Number.isFinite(earlier))return null
  const age=later-earlier
  return age>=0&&Number.isSafeInteger(age)?age:null
}

/** Pure classification. No image pixels, speech or user identities are inputs. */
export function auditFreshSceneAtTurn(args:{
  cameraAuthorized:boolean
  capturedAt:number|null
  detectorEnabled:boolean
  faceSample:VisionFaceSample|null
  now:number
}):VisionAuditResult{
  const result=(status:VisionAuditStatus,frameAgeMs:number|null=null,
    faceCount:number|null=null,faceSampleAgeAtCaptureMs:number|null=null
  ):VisionAuditResult=>({
    status,frameAgeMs,faceCount,faceSampleAgeAtCaptureMs,
    faceEvidenceIsIdentity:false,cameraAutoOpened:false,
  })
  if(!args.cameraAuthorized)return result('camera-not-authorized')
  if(args.capturedAt===null)return result('no-current-frame')
  const frameAge=validAge(args.now,args.capturedAt)
  if(frameAge===null)return result('no-current-frame')
  if(frameAge>AUDIT_CURRENT_FRAME_MAX_AGE_MS)return result('frame-aged',frameAge)
  if(!args.detectorEnabled)return result('face-detector-off',frameAge)
  if(!args.faceSample)return result('face-detector-unavailable',frameAge)
  const count=args.faceSample.count
  if(!Number.isInteger(count)||count<0||count>FACE_DETECTOR_MAX_RESULTS){
    return result('face-detector-unavailable',frameAge)
  }
  const sampleAge=validAge(args.capturedAt,args.faceSample.observedAt)
  if(sampleAge===null||sampleAge>FACE_DETECTOR_STALE_MS){
    return result('face-detector-stale',frameAge)
  }
  return result('face-presence-available',frameAge,count,sampleAge)
}
