/**
 * PH-04.8 — reversible cinematic locomotion stage for the local raw-VRM0
 * portal. The original R8 FBX retarget intentionally discards root POSITION
 * tracks. This adapter therefore choreographs a bounded *presentation* path
 * during the real walking clip; it does not claim to restore original root
 * motion or modify the private assets.
 *
 * Walking in place stays fixed. Walking forward approaches the viewer.
 * Walking in circle follows a closed orbital path with matching facing.
 * The fixed portal camera, rings, UI, face and lip sync are not modified.
 */
export type WalkMotionId = 'walking' | 'walkingforward' | 'walkingcircle'
export type WalkStagePose = { x: number; z: number; yaw: number }
export const WALK_STAGE_ORBIT_RADIUS = 0.30
export const WALK_STAGE_APPROACH = 0.48

const zero = (): WalkStagePose => ({x:0,z:0,yaw:0})
const clamp = (t:number) => Math.max(0,Math.min(1,Number.isFinite(t)?t:0))
const smooth = (t:number) => {const p=clamp(t);return p*p*(3-2*p)}
const shortestDelta = (a:number,b:number) =>
  Math.atan2(Math.sin(b-a),Math.cos(b-a))

/** The point is tied to FBX playback progress, never a wall-clock guess. */
export function walkStageTarget(
  id: string | null,
  progress: number,
): WalkStagePose {
  const p=clamp(progress)
  if(id==='walkingforward') {
    const advance=smooth((p-.05)/.90)
    return {
      x: .035*Math.sin(Math.PI*p)*Math.sin(2*Math.PI*p),
      z: -WALK_STAGE_APPROACH*advance,
      yaw: .035*Math.sin(2*Math.PI*p),
    }
  }
  if(id==='walkingcircle'){
    const angle=2*Math.PI*p
    return {
      x: WALK_STAGE_ORBIT_RADIUS*(1-Math.cos(angle)),
      z: -WALK_STAGE_ORBIT_RADIUS*Math.sin(angle),
      yaw: -angle,
    }
  }
  // No simulated displacement for the genuine 'Walking in place.fbx'.
  return zero()
}

export class WalkStage {
  private readonly position=zero()
  private lastId:string|null=null
  get pose():Readonly<WalkStagePose> {return this.position}

  step(dt:number,id:string|null,elapsed:number,duration:number,enabled=true):Readonly<WalkStagePose>{
    const boundedDt=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0))
    const moving=enabled&&(id==='walkingforward'||id==='walkingcircle')
      && Number.isFinite(duration)&&duration>0
    const target=moving?walkStageTarget(id,elapsed/duration):zero()
    if(moving&&id!==this.lastId){
      console.info('[lumia:ph048] cinematic walking stage:',id,
        'FBX seconds:',duration.toFixed(2),
        'presentation path (not original FBX root translation)')
    }
    this.lastId=moving?id:null
    // A slower, finite return to center after the clip avoids a one-frame
    // teleport. The stage reset is separate from mixer body-animation time.
    const rate=moving?10:3.5
    const k=1-Math.exp(-boundedDt*rate)
    this.position.x+=(target.x-this.position.x)*k
    this.position.z+=(target.z-this.position.z)*k
    this.position.yaw+=shortestDelta(this.position.yaw,target.yaw)*k
    if(!moving && Math.abs(this.position.x)<1e-5
       && Math.abs(this.position.z)<1e-5
       && Math.abs(shortestDelta(this.position.yaw,0))<1e-5){
      this.position.x=0
      this.position.z=0
      this.position.yaw=0
    }
    return this.position
  }
  reset():void{
    this.position.x=0
    this.position.z=0
    this.position.yaw=0
    this.lastId=null
  }
}
