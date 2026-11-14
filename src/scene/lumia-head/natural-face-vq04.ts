/**
 * VQ-04 — Subtle, non-repeating facial presence for the existing Vita VRM.
 *
 * Real rendered effects: intermittent eyelid blink and bounded micro-gaze.
 * No cameras, face recognition, new models, autonomous microphone access,
 * audio files, bone-rig changes or FBX edits.
 *
 * RNG is a small deterministic xorshift, seeded once per mounted avatar:
 * no frame-to-frame Math.random jitter, no new dependencies.
 */
export type NaturalFaceFrameVQ04 = {
  blink: number
  eyeYaw: number
  eyePitch: number
}

const clamp=(v:number,min:number,max:number)=>
  Number.isFinite(v)?Math.max(min,Math.min(max,v)):min

function easing(p:number){
  const x=clamp(p,0,1)
  return x*x*(3-2*x)
}

export class NaturalFaceMotionVQ04 {
  private seed=0x5f3759df
  private elapsed=0
  private nextBlink=1.8
  private blinkStart=-1
  private blinkDuration=.20
  private blinkCount=0
  private pendingDouble=false
  private nextGaze=1.10
  private eyeYaw=0
  private eyePitch=0
  private targetYaw=0
  private targetPitch=0

  private random():number {
    let x=this.seed>>>0
    x^=x<<13
    x^=x>>>17
    x^=x<<5
    this.seed=x>>>0
    return this.seed/4294967296
  }

  step(dt:number,phase:string,speaking:boolean):NaturalFaceFrameVQ04 {
    const delta=clamp(dt,0,.05)
    this.elapsed+=delta
    if(this.elapsed>=this.nextBlink){
      this.blinkStart=this.elapsed
      this.blinkCount++
      // One occasional double blink among ordinary variable intervals.
      // Not mechanically periodic (unlike legacy 3.73 s).
      if(this.pendingDouble){
        this.pendingDouble=false
        this.nextBlink=this.elapsed+2.65+this.random()*3.2
      }else if(this.blinkCount%6===0){
        this.pendingDouble=true
        this.nextBlink=this.elapsed+.34
      }else{
        this.nextBlink=this.elapsed+2.65+this.random()*3.2
      }
    }

    const blinkAge=this.elapsed-this.blinkStart
    let blink=0
    if(this.blinkStart>=0 && blinkAge>=0 && blinkAge<this.blinkDuration){
      const p=blinkAge/this.blinkDuration
      // Close quickly, open with a gentler settling curve.
      blink=p<.38
        ? easing(p/.38)
        : 1-easing((p-.38)/.62)
    }

    if(this.elapsed>=this.nextGaze){
      const thinking=phase==='thinking'||phase==='tooling'
      const listening=phase==='listening'||phase==='waking'
      const horizontal=thinking?.022:listening?.008:speaking?.014:.017
      const vertical=thinking?.012:listening?.006:.008
      this.targetYaw=(this.random()*2-1)*horizontal
      this.targetPitch=(this.random()*2-1)*vertical
      this.nextGaze=this.elapsed+1.25+this.random()*2.6
    }
    // Eye gaze settles smoothly without accumulating offsets.
    const a=1-Math.exp(-delta*7.0)
    this.eyeYaw+=(this.targetYaw-this.eyeYaw)*a
    this.eyePitch+=(this.targetPitch-this.eyePitch)*a

    return {
      blink:clamp(blink,0,1),
      eyeYaw:clamp(this.eyeYaw,-.024,.024),
      eyePitch:clamp(this.eyePitch,-.014,.014),
    }
  }
}
