import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  OpticalSentinel,
  SENTINEL_WIDTH,SENTINEL_HEIGHT,SENTINEL_INTERVAL_MS,
  SENTINEL_EVENT_COOLDOWN_MS,
  toSentinelLuma,
} from '../src/lib/vision-sentinel-vi032'

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
assert.equal(SENTINEL_WIDTH,96)
assert.equal(SENTINEL_HEIGHT,54)
assert.equal(SENTINEL_INTERVAL_MS,750)
assert.equal(SENTINEL_EVENT_COOLDOWN_MS,8000)

const n=SENTINEL_WIDTH*SENTINEL_HEIGHT
const rgb=new Uint8ClampedArray(n*4)
for(let i=0;i<n;i++){
  rgb[i*4]=80;rgb[i*4+1]=80;rgb[i*4+2]=80;rgb[i*4+3]=255
}
const gray=toSentinelLuma(rgb)
assert.equal(gray.length,n)
assert.equal(gray[0],80)
assert.throws(()=>toSentinelLuma(new Uint8Array(3)),/inválida/i)

const base=Uint8Array.from({length:n},()=>80)
const moved=base.slice()
for(let y=20;y<31;y++)for(let x=35;x<66;x++)moved[y*SENTINEL_WIDTH+x]=142
const detector=new OpticalSentinel()
assert.equal(detector.observe(base,'center',1_000).status,'calibrating')
assert.equal(detector.observe(base,'center',1_750).status,'stable')
assert.equal(detector.observe(moved,'center',2_500).status,'possible-change')
assert.equal(detector.observe(moved,'center',3_250).status,'event')
assert.equal(detector.observe(moved,'center',4_000).status,'stable')

// Outside the central polygon must not trigger the center zone.
detector.reset()
const outside=base.slice()
for(let y=0;y<12;y++)for(let x=0;x<30;x++)outside[y*SENTINEL_WIDTH+x]=142
assert.equal(detector.observe(base,'center',1_000).status,'calibrating')
assert.equal(detector.observe(outside,'center',1_750).status,'stable')

// Switching area resets optical baseline; sudden exposure is not a person event.
assert.equal(detector.observe(outside,'full',2_500).status,'calibrating')
const light=Uint8Array.from({length:n},()=>195)
assert.equal(detector.observe(light,'full',3_250).status,'lighting-change')
assert.equal(detector.observe(light,'full',4_000).status,'stable')
assert.throws(()=>detector.observe(new Uint8Array(3),'full',5_000),/inválido/i)
assert.throws(()=>detector.observe(light,'invalid' as 'full',5_000),/Zona/i)

const ui=read('src/ui/LumiaCameraViewfinder.tsx')
const app=read('src/App.tsx')
const css=read('src/index.css')
const launch=read('INICIAR_LUMIA_ASUS_SENTINEL_CPU_2B_VI032.cmd')
const launch031=read('INICIAR_LUMIA_ASUS_VISION_ACTIVA_VI031.cmd')
const launch030=read('INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd')
const sentinel=read('src/lib/vision-sentinel-vi032.ts')
assert.match(launch,/VITE_LUMIA_VISION_SENTINEL_VI032=1/)
assert.match(launch,/INICIAR_LUMIA_ASUS_VISION_ACTIVA_VI031\.cmd/)
assert.match(launch031,/INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030\.cmd/)
assert.match(launch030,/LUMIA_ASUS_MODEL_OVERRIDE=qwen3\.5:2b-q4_K_M/)
assert.match(app,/VISION_SENTINEL_VI032_ENABLED/)
assert.match(app,/sentinelAvailable=\{VISION_SENTINEL_VI032_ENABLED\}/)
assert.match(ui,/onClick=\{\(\)=>chooseSentinelZone\('center'\)\}/)
assert.match(ui,/onClick=\{\(\)=>chooseSentinelZone\('full'\)\}/)
assert.match(ui,/sentinelTimerRef\.current=window\.setInterval\(sampleSentinel,SENTINEL_INTERVAL_MS\)/)
assert.match(ui,/sentinelRef\.current\.observe\(/)
assert.match(ui,/if\(observed\.status==='event'\)/)
assert.match(ui,/if\(now-lastActiveShotRef\.current>=3_000\)takeActiveFrame\(\)/)
assert.match(ui,/if\(sentinelTimerRef\.current!==null\)\{window\.clearInterval\(/)
assert.match(ui,/visibilitychange/)
assert.match(css,/lumia-vision-sentinel-panel/)
assert.match(css,/lumia-vision-sentinel-overlay/)
assert.doesNotMatch(sentinel,/\b(?:fetch|WebSocket|Worker|speechSynthesis|localStorage|indexedDB)\s*\(/)
assert.doesNotMatch(launch,/ollama (?:pull|rm|create|stop)/)
assert.doesNotMatch(ui,/qwen3\.5:4b-fast|ollama (?:pull|run)/i)
console.log('VI-03.2A PASS: CPU-only polygon optical changes, debounced event, light guard, explicit opt-in, 2B native, no auto inference/4B')
