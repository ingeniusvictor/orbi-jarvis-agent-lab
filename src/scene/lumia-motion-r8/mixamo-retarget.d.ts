import type * as THREE from 'three'
export function mixamoBoneName(name:string):string|null
export function retargetMixamoUpperBody(
  asset:THREE.Object3D,
  vrm:unknown,
  three:typeof THREE,
  options?:{fullBody?:boolean;includeHips?:boolean;includeHead?:boolean},
):{
  clip:THREE.AnimationClip
  matched:string[]
  ignored:string[]
  tracks:number
  sourceTrackCount:number
  duration:number
}
