import type * as THREE from 'three'
export class PoseTransition {
  constructor(duration?:number)
  get active():boolean
  capture(nodes:Array<THREE.Object3D|null|undefined>,duration?:number):number
  step(dt:number):number
  clear():void
}
