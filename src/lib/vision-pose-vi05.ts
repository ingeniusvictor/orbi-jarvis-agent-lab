/**
 * VI-05A.1 — explain *why* a CPU pose is indeterminate.
 * Preserve VI-05A arm classification and two-frame confirmation thresholds.
 * Data leaving the worker: categories only; no coordinates, screenshots,
 * identity, body measurements, keypoint arrays or time series.
 */
export const POSE_VI05_INTERVAL_MS=2500
export const POSE_VI05_MAX_WIDTH=640
export const POSE_VI05_MAX_HEIGHT=360
export const POSE_VI05_RESPONSE_TIMEOUT_MS=6000
export const POSE_VI05_MIN_VISIBILITY=0.65

export type ArmPosture='raised'|'down'|'unclear'
export type ArmSide='left'|'right'
export type PoseLandmark={x:number;y:number;visibility?:number;presence?:number}
export type ArmDiagnostic=
  | 'raised'|'down'|'angle-ambiguous'|'no-pose'
  | 'shoulder-missing'|'elbow-missing'|'wrist-missing'
  | 'shoulder-outside'|'elbow-outside'|'wrist-outside'
  | 'shoulder-low-confidence'|'elbow-low-confidence'|'wrist-low-confidence'
  | 'shoulder-no-confidence'|'elbow-no-confidence'|'wrist-no-confidence'
export type BodyPoseSummary={
  found:boolean
  leftArm:ArmPosture
  rightArm:ArmPosture
  leftDiagnostic:ArmDiagnostic
  rightDiagnostic:ArmDiagnostic
  shouldersVisible:boolean
  inferenceMs:number|null
  stabilizing:boolean
}

const unclear=():BodyPoseSummary=>({
  found:false,leftArm:'unclear',rightArm:'unclear',
  leftDiagnostic:'no-pose',rightDiagnostic:'no-pose',
  shouldersVisible:false,inferenceMs:null,stabilizing:false,
})

type PointIssue='missing'|'outside'|'low-confidence'|'no-confidence'
type PointResult={landmark:PoseLandmark|null;issue:PointIssue|null}
const point=(all:readonly PoseLandmark[],index:number):PointResult=>{
  const p=all[index]
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))
    return {landmark:null,issue:'missing'}
  if(p.x<0||p.x>1||p.y<0||p.y>1)
    return {landmark:null,issue:'outside'}
  const scores=[p.visibility,p.presence].filter((v):v is number=>v!==undefined)
  if(!scores.length)return {landmark:null,issue:'no-confidence'}
  if(scores.some(v=>!Number.isFinite(v)||v<POSE_VI05_MIN_VISIBILITY))
    return {landmark:null,issue:'low-confidence'}
  return {landmark:p,issue:null}
}
type ArmAssessment={state:ArmPosture;diagnostic:ArmDiagnostic}
function classifyArm(landmarks:readonly PoseLandmark[],side:ArmSide):ArmAssessment{
  const indices=side==='left'?[11,13,15]:[12,14,16]
  const parts=['shoulder','elbow','wrist'] as const
  const inspected=indices.map(n=>point(landmarks,n))
  for(let i=0;i<3;i++){
    const issue=inspected[i].issue
    if(issue)return {
      state:'unclear',
      diagnostic:(parts[i]+'-'+issue) as ArmDiagnostic,
    }
  }
  const shoulder=inspected[0].landmark!
  const elbow=inspected[1].landmark!
  const wrist=inspected[2].landmark!
  const rise=shoulder.y-wrist.y
  // Image Y grows downward; preserve VI-05A thresholds.
  if(rise>0.10)return {state:'raised',diagnostic:'raised'}
  if(rise< -0.12 && elbow.y>shoulder.y-0.04)
    return {state:'down',diagnostic:'down'}
  return {state:'unclear',diagnostic:'angle-ambiguous'}
}

export function summarizeBodyPose(
  poses:readonly (readonly PoseLandmark[])[],
  inferenceMs:number|null=null,
):BodyPoseSummary{
  if(!poses.length||poses[0].length<17)return unclear()
  const p=poses[0]
  const left=classifyArm(p,'left')
  const right=classifyArm(p,'right')
  return {
    found:true,leftArm:left.state,rightArm:right.state,
    leftDiagnostic:left.diagnostic,rightDiagnostic:right.diagnostic,
    shouldersVisible:point(p,11).landmark!==null && point(p,12).landmark!==null,
    inferenceMs:inferenceMs!==null&&Number.isFinite(inferenceMs)&&inferenceMs>=0
      ? Math.round(inferenceMs):null,
    stabilizing:false,
  }
}
export function poseDiagnosticText(value:ArmDiagnostic):string{
  switch(value){
    case 'raised':return 'levantado'
    case 'down':return 'abajo'
    case 'angle-ambiguous':return 'ángulo no concluyente'
    case 'no-pose':return 'sin cuerpo detectable'
    case 'shoulder-missing':return 'hombro no detectado'
    case 'elbow-missing':return 'codo no detectado'
    case 'wrist-missing':return 'muñeca no detectada'
    case 'shoulder-outside':return 'hombro fuera del encuadre'
    case 'elbow-outside':return 'codo fuera del encuadre'
    case 'wrist-outside':return 'muñeca fuera del encuadre'
    case 'shoulder-low-confidence':return 'hombro poco fiable'
    case 'elbow-low-confidence':return 'codo poco fiable'
    case 'wrist-low-confidence':return 'muñeca poco fiable'
    case 'shoulder-no-confidence':return 'hombro sin confianza'
    case 'elbow-no-confidence':return 'codo sin confianza'
    case 'wrist-no-confidence':return 'muñeca sin confianza'
  }
}

/** Require two consecutive identical postures. Never retain raw keypoints. */
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
      shouldersVisible:false,stabilizing:value.found,
    }
  }
}
