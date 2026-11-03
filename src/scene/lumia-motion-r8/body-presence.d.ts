export const PRESENCE_DEFAULTS:Readonly<{enabled:boolean;idleLevel:number;listeningLevel:number}>
export class BodyPresenceCore {
  constructor()
  step(dt:number,config?:Record<string,unknown>):{
    offsets:Record<string,number>;headPitch:number;idleWeight:number;listeningWeight:number;visible:boolean
  }
}
