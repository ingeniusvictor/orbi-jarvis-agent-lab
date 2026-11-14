/**
 * VQ-05.1: unmistakable but reversible owner-requested face demonstration.
 * Uses the exact existing Vita VRM0 morph presets, with no new face rig.
 * Run only after a local explicit command; never infer user emotion.
 */
export type FacePreviewPresetVQ051='joy'|'sorrow'|'fun'|'angry'|'neutral'
export type FacePreviewFrameVQ051={
  active:boolean
  requested:FacePreviewPresetVQ051|null
  weights:Record<Exclude<FacePreviewPresetVQ051,'neutral'>,number>
}
const PRESETS=['joy','sorrow','fun','angry'] as const
const clamp=(x:number,min:number,max:number)=>
  Number.isFinite(x)?Math.max(min,Math.min(max,x)):min
const DEMO_WEIGHT=.80
const HOLD_SECONDS=7.8

export class FacePreviewVQ051 {
  private requested:FacePreviewPresetVQ051|null=null
  private elapsed=0
  private readonly values={
    joy:0,sorrow:0,fun:0,angry:0,
  }
  private hasCue=false

  cue(preset:FacePreviewPresetVQ051):void {
    if(preset!=='neutral' && !PRESETS.includes(preset))return
    this.requested=preset
    this.hasCue=true
    this.elapsed=0
  }
  step(dt:number,blocked=false):FacePreviewFrameVQ051 {
    const delta=clamp(dt,0,.05)
    if(this.hasCue && !blocked)this.elapsed+=delta
    const hold=this.hasCue && !blocked && this.elapsed<HOLD_SECONDS
    for(const name of PRESETS){
      const target=hold && this.requested===name?DEMO_WEIGHT:0
      const rate=target>this.values[name]?5.5:5.0
      this.values[name]+=(target-this.values[name])*(1-Math.exp(-delta*rate))
      if(this.values[name]<.0005)this.values[name]=0
    }
    const active=this.hasCue && (hold || PRESETS.some(k=>this.values[k]>.005))
    if(this.hasCue && !active){
      this.hasCue=false
      this.requested=null
    }
    return {
      active,
      requested:this.requested,
      weights:{...this.values},
    }
  }
}
