export type R8SemanticPose={
  head:{pitch:number;yaw:number;roll:number}
  body:Record<string,number>
  kind:string|null
  label:string
}
export class SemanticMotionCore {
  constructor(options?:Record<string,unknown>)
  begin(text:string):Array<Record<string,unknown>>
  end():void
  step(dt:number,options?:{speaking?:boolean;manual?:boolean;dancing?:boolean}):R8SemanticPose
  snapshot():Record<string,unknown>
}
