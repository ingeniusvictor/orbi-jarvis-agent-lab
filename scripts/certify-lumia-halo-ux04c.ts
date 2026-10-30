import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { requiredHaloTextInset } from '../src/lib/halo-text-guard'
import { haloCircleForCanvas, computeHaloExclusion } from '../src/lib/halo-flow-geometry'

const canvas={left:0,top:0,width:1827,height:867}
const circle=haloCircleForCanvas(canvas)
assert.equal(circle.x,913.5)
assert.equal(circle.y,433.5)
assert.ok(circle.radius > 340) // shader outer ring + bloom + UX-04C safe band

// Screenshot regression: response started at x≈943, y≈610 while halo still
// occupied that area. A "correct" polygon alone cannot guarantee CSS layout.
const exposedRight=[{left:943,right:1270,top:597,bottom:620}]
const exposedLeft=[{left:520,right:851,top:597,bottom:620}]
const neededRight=requiredHaloTextInset('right',exposedRight,circle)
const neededLeft=requiredHaloTextInset('left',exposedLeft,circle)
assert.ok(neededRight>240 && neededRight<330)
assert.ok(neededLeft>240 && neededLeft<330)

// The fallback must physically move glyph boxes beyond the ring, even if
// Chromium ignores shape-outside around display:block children.
const ringRight=circle.x+Math.sqrt(
  Math.pow(circle.radius+14,2)-Math.pow(597-circle.y,2))
assert.ok(943+Math.ceil(neededRight+3) > ringRight)
const ringLeft=circle.x-Math.sqrt(
  Math.pow(circle.radius+14,2)-Math.pow(597-circle.y,2))
assert.ok(851-Math.ceil(neededLeft+3) < ringLeft)

assert.equal(requiredHaloTextInset('right',
  [{left:1300,right:1420,top:597,bottom:620}],circle),0)
assert.equal(requiredHaloTextInset('left',
  [{left:400,right:500,top:597,bottom:620}],circle),0)
assert.equal(requiredHaloTextInset('right',
  [{left:943,right:1300,top:25,bottom:45}],circle),0)
assert.equal(requiredHaloTextInset('right',[],circle),0)
assert.equal(requiredHaloTextInset('right',
  [{left:Number.NaN,right:0,top:0,bottom:0}],circle),0)

// Multiple lines: reject partial collision even if one text line is safe.
const mixed=[
  {left:1320,right:1400,top:600,bottom:618},
  {left:950,right:1200,top:621,bottom:645},
]
assert.ok(requiredHaloTextInset('right',mixed,circle)>200)

// Native shape is still preferred and remains mirrored.
const left=computeHaloExclusion('left',
  {left:96,right:855,top:310,bottom:700,width:759},circle,180)
const right=computeHaloExclusion('right',
  {left:970,right:1725,top:310,bottom:700,width:755},circle,180)
assert.ok(left && right)
assert.equal(left.float,'right')
assert.equal(right.float,'left')
assert.match(right.shape,/^polygon\(/)

const flow=readFileSync(new URL('../src/ui/HaloFlow.tsx',import.meta.url),'utf8')
const geometry=readFileSync(new URL('../src/lib/halo-flow-geometry.ts',import.meta.url),'utf8')
assert.match(flow,/document\.createTreeWalker\(element, NodeFilter\.SHOW_TEXT\)/)
assert.match(flow,/range\.getClientRects\(\)/)
assert.match(flow,/requiredHaloTextInset\(side, lines, circle, 14\)/)
assert.match(flow,/spacer\.style\.display = 'none'/)
assert.match(flow,/Math\.max\(0, element\.getBoundingClientRect\(\)\.width - MIN_READABLE_TEXT\)/)
assert.match(flow,/element\.style\.paddingLeft = next \+ 'px'/)
assert.match(flow,/element\.style\.paddingRight = next \+ 'px'/)
assert.match(flow,/cancelAnimationFrame\(guardFrame\)/)
assert.match(flow,/pane\.addEventListener\('scroll', schedule/)
assert.match(geometry,/radius: Math\.min\(rect\.height, rect\.width\) \* 0\.355 \+ 36/)
console.log('UX-04C: outer glow band, actual glyph collision fallback, mirrored sides and no text clipping PASS')
