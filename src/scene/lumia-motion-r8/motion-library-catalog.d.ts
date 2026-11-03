export type R8MotionCatalogEntry={
  id:string
  file:string
  path:string
  label:string
  category:string
  loop:boolean
  repetitions:number|null
  fullBody:boolean
  includeHips?:boolean
  includeHead?:boolean
}
export const motionCatalog:R8MotionCatalogEntry[]
export const animationLibrary:Record<string,R8MotionCatalogEntry>
