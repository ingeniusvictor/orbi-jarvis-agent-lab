/**
 * VQ-03.2: read-only, console-only render/animation instrumentation for the
 * isolated ASUS QA launcher. OFF by default for LUMIA-ASUS.
 * No camera, audio, photo, names, network, files, frame dumps or access change.
 *
 * Motion evidence: an AnimationAction advanced through time AND post-guard
 * arm-bone quaternions deviated from the procedural pose. This is stronger
 * than "command accepted" but does not prove a visually pleasing hand wave.
 */
export const VQ03_AVATAR_QA_ENABLED = typeof import.meta.env !== 'undefined' &&
  import.meta.env.VITE_LUMIA_AVATAR_QA_VQ03 === '1'

export type Vq03AvatarAuditEvent = {
  event: 'vrm-first-frame' | 'motion-requested' | 'motion-started' |
    'motion-pose-progress' | 'motion-completed' | 'motion-interrupted' |
    'motion-unavailable'
  view?: 'head-vrm' | 'bust-vrm' | 'body-vrm' | 'legacy'
  id?: string
  fbxFrames?: number
  advancedSeconds?: number
  maxArmDeviationDeg?: number
  sampledBoneCount?: number
  animationEvidence?: boolean
  reason?: string
  clipEnabled?: boolean
  bodyBones?: number
}

export function reportVq03AvatarQA(event:Vq03AvatarAuditEvent):void {
  if (!VQ03_AVATAR_QA_ENABLED) return
  // No raw transcripts, camera frames or assets. Object keys are allowlisted.
  console.info('[lumia:vq03-avatar]',JSON.stringify(event))
}

export function angleBetweenQuaternionsDegrees(
  a:{x:number;y:number;z:number;w:number},
  b:{x:number;y:number;z:number;w:number},
):number{
  const dot=Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w)
  const angle=(2*180/Math.PI)*Math.acos(Math.min(1,Math.max(0,dot)))
  return Number.isFinite(angle)?angle:0
}

/** Pure accumulator: no reporting, no dependence on a browser or model. */
export class Vq03MotionEvidence {
  private frames=0
  private beganAt:number|null=null
  private latestAt=0
  private maxAngle=0
  private sampledBones=0
  private reportedProgress=false

  addFrame(actionTime:number,angles:number[],active:boolean):boolean{
    if(!active || !Number.isFinite(actionTime) || actionTime<0)return false
    if(this.beganAt===null)this.beganAt=actionTime
    this.latestAt=Math.max(this.latestAt,actionTime)
    this.frames++
    this.sampledBones=Math.max(this.sampledBones,angles.length)
    for(const a of angles){
      if(Number.isFinite(a)&&a>=0)this.maxAngle=Math.max(this.maxAngle,a)
    }
    if(!this.reportedProgress && this.evidenceReady()){
      this.reportedProgress=true
      return true
    }
    return false
  }
  evidenceReady():boolean{
    return this.frames>=3 && this.advancedSeconds()>=0.10 &&
      this.sampledBones>=1 && this.maxAngle>=3
  }
  advancedSeconds():number{
    return Math.max(0,this.latestAt-(this.beganAt??this.latestAt))
  }
  snapshot(){
    return {
      fbxFrames:this.frames,
      advancedSeconds:Number(this.advancedSeconds().toFixed(3)),
      maxArmDeviationDeg:Number(this.maxAngle.toFixed(2)),
      sampledBoneCount:this.sampledBones,
      animationEvidence:this.evidenceReady(),
    }
  }
}
