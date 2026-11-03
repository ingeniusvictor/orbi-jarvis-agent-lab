export class BodyMotionCore {
  elapsed:number
  gestureName:string|null
  requestGesture(name:string):boolean
  requestWave():boolean
  requestExplain():boolean
  requestPoint():boolean
  requestWelcome():boolean
  clearGestures():void
  step(dt:number,config?:Record<string,unknown>):Record<string,number>
}
