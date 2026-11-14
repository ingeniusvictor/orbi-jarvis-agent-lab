import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {
  VA02_TEST_PHRASES,percentile,measureVa02,
} from './lumia-kokoro-latency-baseline-va02.mjs'

assert.equal(VA02_TEST_PHRASES.length,4)
assert.equal(new Set(VA02_TEST_PHRASES).size,4)
assert.equal(percentile([600,300,1000,200],.5),300)
assert.equal(percentile([600,300,1000,200],.95),1000)
assert.equal(percentile([600,300,1000,200],1),1000)
assert.throws(()=>percentile([],.5),/VA02_INVALID_SAMPLES/)
assert.throws(()=>percentile([5,-2],.5),/VA02_INVALID_SAMPLES/)
assert.throws(()=>percentile([1],2),/VA02_INVALID_PERCENTILE/)

const fakeWav=new Uint8Array(48)
fakeWav.set(new TextEncoder().encode('RIFF'),0)
fakeWav.set(new TextEncoder().encode('WAVE'),8)
let now=0,calls=0
const summary=await measureVa02({
  phrases:['uno','dos'],rounds:2,
  clock:()=>now,
  synth:async()=>{
    calls++
    now+=calls*100
    return {provider:'kokoro-local-resident',audio:fakeWav}
  },
})
assert.equal(calls,4)
assert.equal(summary.phrases,2)
assert.equal(summary.rounds,2)
assert.deepEqual(summary.observations.map(x=>x.elapsedMs),[100,200,300,400])
assert.equal(summary.p50Ms,200)
assert.equal(summary.p95Ms,400)
assert.equal(summary.maxMs,400)
assert.ok(summary.observations.every(x=>x.wavBytes===48))
assert.match(summary.measures,/excludes Chrome playback/)
await assert.rejects(
  ()=>measureVa02({synth:async()=>({provider:'kokoro-local',audio:fakeWav})}),
  /VA02_SYNTHESIS_OR_RESIDENT_FAILED/,
)
await assert.rejects(
  ()=>measureVa02({synth:async()=>({provider:'kokoro-local-resident',audio:new Uint8Array(1)})}),
  /VA02_SYNTHESIS_OR_RESIDENT_FAILED/,
)
await assert.rejects(
  ()=>measureVa02({synth:async()=>({provider:'kokoro-local-resident',audio:fakeWav}),rounds:4}),
  /VA02_INVALID_ARGUMENTS/,
)
const source=readFileSync(fileURLToPath(new URL('./lumia-kokoro-latency-baseline-va02.mjs',import.meta.url)),'utf8')
assert.match(source,/auditQaCheckout\(\{original,qa\}\)/)
assert.match(source,/makeVoiceQaChildEnv\(original\)/)
assert.match(source,/ORBIA_KOKORO_RESIDENT_ENABLED:'1'/)
assert.match(source,/prewarmResidentKokoro\(env\)/)
assert.match(source,/synthesizeLocalSpeech\(text,\{env\}\)/)
assert.match(source,/Prueba breve de voz local/)
assert.doesNotMatch(source,/writeFileSync|cpSync|copyFileSync|symlink|fetch\(/)
assert.doesNotMatch(source,/\.local-runtime\/.+\/models\/.*write/)
console.log('VA-02 PASS: fixed-phrase baseline, warm resident, fail-closed WAV/provider, read-only protected ASUS, no audio retention')
