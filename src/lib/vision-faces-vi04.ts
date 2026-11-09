/**
 * LUMIA VISION-04A — Face presence metadata only.
 * No face embeddings, names, inferred identity or image persistence.
 */
export const FACE_DETECTOR_INTERVAL_MS=900
export const FACE_DETECTOR_MAX_WIDTH=640
export const FACE_DETECTOR_MAX_HEIGHT=360
export const FACE_DETECTOR_MAX_RESULTS=8
export const FACE_DETECTOR_STALE_MS=3_500

export type FaceBox={
  x:number
  y:number
  width:number
  height:number
  score:number
}
type RawDetection={
  boundingBox?:{originX:number;originY:number;width:number;height:number}|null
  categories?:Array<{score:number}>
}
const clamp=(n:number)=>Math.max(0,Math.min(1,n))

/** Converts MediaPipe pixel bounding boxes to normalized, unmirrored video positions. */
export function normalizeDetectedFaces(
  raw:readonly RawDetection[],
  imageWidth:number,
  imageHeight:number,
):FaceBox[]{
  if(!Number.isFinite(imageWidth)||!Number.isFinite(imageHeight)||imageWidth<=0||imageHeight<=0)return []
  const out:FaceBox[]=[]
  for(const detection of raw){
    if(out.length>=FACE_DETECTOR_MAX_RESULTS)break
    const box=detection.boundingBox
    const score=detection.categories?.[0]?.score??0
    if(!box||![box.originX,box.originY,box.width,box.height,score].every(Number.isFinite)||
       box.width<=0||box.height<=0||score<0.50)continue
    const left=clamp(box.originX/imageWidth)
    const top=clamp(box.originY/imageHeight)
    const right=clamp((box.originX+box.width)/imageWidth)
    const bottom=clamp((box.originY+box.height)/imageHeight)
    if(right-left<0.008||bottom-top<0.008)continue
    out.push({x:left,y:top,width:right-left,height:bottom-top,score:clamp(score)})
  }
  return out
}

/** Two consecutive observations are required before displaying a count as stable. */
export class FaceCountGate{
  private candidate:number|null=null
  private consecutive=0
  private confirmed:number|null=null
  private lastAt=0
  reset():void{this.candidate=null;this.consecutive=0;this.confirmed=null;this.lastAt=0}
  observe(count:number,at:number):number|null{
    if(!Number.isInteger(count)||count<0||count>FACE_DETECTOR_MAX_RESULTS||
       !Number.isFinite(at))return null
    if(this.lastAt!==0 && (at<this.lastAt||at-this.lastAt>FACE_DETECTOR_STALE_MS))this.reset()
    this.lastAt=at
    if(this.candidate===count)this.consecutive++
    else{this.candidate=count;this.consecutive=1}
    if(this.consecutive>=2)this.confirmed=count
    return this.confirmed
  }
}
