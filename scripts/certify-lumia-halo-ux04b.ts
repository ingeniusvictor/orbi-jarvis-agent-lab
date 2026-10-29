import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computeHaloExclusion, haloCircleForCanvas } from '../src/lib/halo-flow-geometry'
const source=readFileSync(new URL('../src/ui/HaloFlow.tsx',import.meta.url),'utf8')
const html=readFileSync(new URL('../src/ui/Hud.tsx',import.meta.url),'utf8')
const launcher=readFileSync(new URL('../INICIAR_LUMIA_ASUS_RAPIDA.cmd',import.meta.url),'utf8')

const canvas={left:0,top:0,width:1760,height:840}
const circle=haloCircleForCanvas(canvas)
assert.equal(circle.x,880)
assert.equal(circle.y,420)
const paneLeft={left:96,right:855,top:300,bottom:753,width:759}
const paneRight={left:905,right:1664,top:300,bottom:753,width:759}
const left=computeHaloExclusion('left',paneLeft,circle,250)
const right=computeHaloExclusion('right',paneRight,circle,250)
assert.ok(left && right)
assert.equal(left.float,'right')
assert.equal(right.float,'left')
assert.equal(left.width,right.width) // mirror symmetry
assert.equal(left.height,right.height)
assert.match(left.shape,/^polygon\(/)
assert.match(right.shape,/^polygon\(/)
// Polygon coordinates are always constrained to the float's margin box.
// Mirror directions, not letter orientation: output must flow to the RIGHT.
const points=(shape:string): Array<{x:number;y:number}> =>
  Array.from(shape.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g),
    m=>({x:Number(m[1]),y:Number(m[2])}))
const leftPoints=points(left.shape), rightPoints=points(right.shape)
assert.equal(leftPoints[0].x,left.width)
assert.equal(rightPoints[0].x,0)
assert.ok(leftPoints.some(p=>p.x<left.width-80))
assert.ok(rightPoints.some(p=>p.x>80))
assert.ok(leftPoints.every(p=>p.x>=0 && p.x<=left.width))
assert.ok(rightPoints.every(p=>p.x>=0 && p.x<=right.width))
assert.ok(left.width<=paneLeft.width-175)
assert.ok(right.width<=paneRight.width-175)
const leftOutside=computeHaloExclusion('left',
  {left:30,right:330,top:300,bottom:500,width:300},circle,90)
const rightOutside=computeHaloExclusion('right',
  {left:1420,right:1720,top:300,bottom:500,width:300},circle,90)
assert.equal(leftOutside,null)
assert.equal(rightOutside,null)
assert.equal(computeHaloExclusion('right',
  {...paneRight,top:800,bottom:900},circle,60),null)
assert.equal(computeHaloExclusion('right',
  {...paneRight,width:170},circle,60),null)
assert.equal(computeHaloExclusion('right',
  {...paneRight,width:Number.NaN},circle,60),null)
const offset=haloCircleForCanvas({left:25,top:42,width:1000,height:800})
assert.equal(offset.x,525)
assert.equal(offset.y,442)
assert.match(source,/canvas\.scene/)
assert.match(source,/computeHaloExclusion\(/)
assert.match(source,/haloCircleForCanvas\(/)
assert.match(source,/observer\.disconnect\(\)/)
assert.match(source,/pane\.style\.background = formerBackground/)
assert.match(html,/<HaloFlow side="left">/)
assert.match(html,/<HaloFlow side="right">/)
assert.match(launcher,/set "VITE_LUMIA_CURVED_TEXT=1"/)
console.log('LUMIA UX-04B: mirrored right/left halo geometry, real canvas origin and layout fallback PASS')
