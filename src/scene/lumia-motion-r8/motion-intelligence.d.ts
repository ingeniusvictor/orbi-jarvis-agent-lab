export type R8MotionIntent={id:string;reason:string;revision:number}
export class MotionIntelligence {
  constructor(options?:Record<string,unknown>)
  observe(state:string,now:number):boolean
  decide(options?:Record<string,unknown>):R8MotionIntent|null
  commit(intent:R8MotionIntent|null,now:number):boolean
  snapshot():Record<string,unknown>
}
