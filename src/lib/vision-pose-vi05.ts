/**
 * VI-05A — CPU body-pose sentinel, opt-in only and single-person.
 *
 * Pure landmark-to-posture interpretation. No pixels, names, history,
 * identity tracking, gestures inferred from time, or model calls.
 * Pose landmark indices follow MediaPipe's 33-point topology.
 */
export const POSE_VI05_INTERVAL_MS=2500
export const POSE_VI05_MAX_WIDTH=640
export const POSE_VI05_MAX_HEIGHT=360
export const POSE_VI05_RESPONSE_TIMEOUT_MS=6000
export const POSE_VI05_MIN_VISIBILITY=0.65

export type ArmPosture='raised'|'down'|'unclear'
export type ArmSide='left'|'right'
export type PoseLandmark={x:number;y:number;visibility?:number;presence?:number}
export type BodyPoseSummary={
  found:boolean
  leftArm:ArmPosture
  rightArm:ArmPosture
  shouldersVisible:boolean
  inferenceMs:number|null
}

const unclear=():BodyPoseSummary=>({
  found:false,leftArm:'unclear',rightArm:'unclear',
  shouldersVisible:false,inferenceMs:null,
})
const point=(all:readonly PoseLandmark[],index:number):PoseLandmark|null=>{
  const p=all[index]
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||
    p.x<0||p.x>1||p.y<0||p.y>1)return null
  const scores=[p.visibility,p.presence].filter((v):v is number=>v!==undefined)
  // If MediaPipe provides neither confidence, do not assert the pose.
  if(!scores.length||scores.some(v=>!Number.isFinite(v)||v<POSE_VI05_MIN_VISIBILITY))return null
  return p
}
function classifyArm(landmarks:readonly PoseLandmark[],side:ArmSide):ArmPosture{
  const indices=side==='left'?[11,13,15]:[12,14,16]
  const shoulder=point(landmarks,indices[0])
  const elbow=point(landmarks,indices[1])
  const wrist=point(landmarks,indices[2])
  if(!shoulder||!elbow||!wrist)return 'unclear'
  const rise=shoulder.y-wrist.y
  // Image coordinates grow downward; wrist decisively higher than shoulder.
  if(rise>0.10)return 'raised'
  if(rise< -0.12 && elbow.y>shoulder.y-0.04)return 'down'
  return 'unclear'
}
export function summarizeBodyPose(
  poses:readonly (readonly PoseLandmark[])[],
  inferenceMs:number|null=null,
):BodyPoseSummary{
  if(!poses.length||poses[0].length<17)return unclear()
  const p=poses[0]
  const shouldersVisible=Boolean(point(p,11)&&point(p,12))
  return {
    found:true,
    leftArm:classifyArm(p,'left'),
    rightArm:classifyArm(p,'right'),
    shouldersVisible,
    inferenceMs:inferenceMs!==null&&Number.isFinite(inferenceMs)&&inferenceMs>=0
      ? Math.round(inferenceMs):null,
  }
}
/** Debounce two consecutive identical states; never retain raw keypoints. */
export class BodyPoseGate{
  private previous:BodyPoseSummary|null=null
  private stable=0
  reset():void{this.previous=null;this.stable=0}
  observe(value:BodyPoseSummary):BodyPoseSummary{
    const same=this.previous && value.found && this.previous.found &&
      value.leftArm===this.previous.leftArm &&
      value.rightArm===this.previous.rightArm &&
      value.shouldersVisible===this.previous.shouldersVisible
    this.stable=same?this.stable+1:1
    this.previous=value
    return this.stable>=2?value:{
      ...value,leftArm:'unclear',rightArm:'unclear',
      shouldersVisible:false,
    }
  }
}
