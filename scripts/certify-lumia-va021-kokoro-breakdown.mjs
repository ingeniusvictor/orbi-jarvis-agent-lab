import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {
  validateVa021WorkerTimings,lastResidentKokoroVa021Timing,stopResidentKokoroVa021,
} from '../bridge/orbia/resident-tts.mjs'
import {
  validateVa021Observation,summarizeVa021,
} from './lumia-kokoro-latency-breakdown-va021.mjs'

const w=validateVa021WorkerTimings({
  g2pMs:29.25,inferenceMs:1187.65,wavWriteMs:2.02,
})
assert.deepEqual(w,{g2pMs:29.3,inferenceMs:1187.7,wavWriteMs:2})
assert.ok(Object.isFrozen(w))
assert.equal(lastResidentKokoroVa021Timing(),null,'No resident created by import')
assert.equal(stopResidentKokoroVa021({}),false,'Cannot stop ordinary LUMIA')
assert.equal(stopResidentKokoroVa021({ORBIA_VA021_KOKORO_PROFILE:'1'}),false,'No worker started by import')
for(const fake of [
  null,{}, {g2pMs:NaN,inferenceMs:2,wavWriteMs:2},
  {g2pMs:1,inferenceMs:-1,wavWriteMs:2},
  {g2pMs:1,inferenceMs:40000,wavWriteMs:2},
  {g2pMs:1,inferenceMs:Infinity,wavWriteMs:2},
  {g2pMs:'1',inferenceMs:2,wavWriteMs:2},
])assert.equal(validateVa021WorkerTimings(fake),null)
const metric={...w,queueWaitMs:0,workerRoundTripMs:1225,wavReadMs:4}
assert.deepEqual(validateVa021Observation(metric),metric)
assert.equal(validateVa021Observation({...metric,queueWaitMs:-1}),null)
assert.equal(validateVa021Observation({...metric,wavReadMs:Infinity}),null)
assert.equal(validateVa021Observation({}),null)
const stats=summarizeVa021([
  metric,{...metric,inferenceMs:1270,workerRoundTripMs:1300},
])
assert.equal(stats.inferenceMs.p50Ms,1187.7)
assert.equal(stats.inferenceMs.maxMs,1270)
assert.equal(stats.workerRoundTripMs.maxMs,1300)
assert.throws(()=>summarizeVa021([]),/VA021_INVALID_TIMINGS/)
assert.throws(()=>summarizeVa021([{...metric,wavWriteMs:-2}]),/VA021_INVALID_TIMINGS/)
const read=p=>readFileSync(fileURLToPath(new URL('../'+p,import.meta.url)),'utf8')
const python=read('bridge/runtime/kokoro/resident.py')
const node=read('bridge/orbia/resident-tts.mjs')
const benchmark=read('scripts/lumia-kokoro-latency-breakdown-va021.mjs')
const production=read('INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd')
const qa=read('INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd')
assert.match(python,/PROFILE_VA021 = os\.environ\.get\('ORBIA_VA021_KOKORO_PROFILE'\) == '1'/)
assert.match(python,/t0 = time\.perf_counter\(\)/)
assert.match(python,/t1 = time\.perf_counter\(\)/)
assert.match(python,/t2 = time\.perf_counter\(\)/)
assert.match(python,/t3 = time\.perf_counter\(\)/)
assert.match(python,/packet\["timingsMs"\]/)
assert.match(python,/sf\.write\(target, audio, sample_rate, subtype="PCM_16"\)/)
assert.match(node,/if \(env\.ORBIA_VA021_KOKORO_PROFILE === '1'\)/)
assert.match(node,/const task = fifo\.then/)
assert.match(node,/job\.resolve\(validateVa021WorkerTimings/)
assert.match(benchmark,/auditQaCheckout\(\{original,qa\}\)/)
assert.match(benchmark,/makeVoiceQaChildEnv\(original\)/)
assert.match(benchmark,/prewarmResidentKokoro\(env\)/)
assert.match(benchmark,/measureVa02\(\{/)
assert.match(benchmark,/phrases:VA02_TEST_PHRASES/)
assert.match(benchmark,/rounds:2/)
assert.match(benchmark,/stopResidentKokoroVa021\(env\)/)
assert.match(node,/if \(env\.ORBIA_VA021_KOKORO_PROFILE !== '1'\) return false/)
assert.match(benchmark,/VA021_WRONG_QA_ROOT/)
assert.doesNotMatch(production,/ORBIA_VA021_KOKORO_PROFILE/)
assert.doesNotMatch(qa,/ORBIA_VA021_KOKORO_PROFILE/)
for(const source of [python,node,benchmark]){
  assert.doesNotMatch(source,/uploadBlob|fetch\('https|writeFileSync|copyFileSync|symlinkSync/)
}
console.log('VA-02.1 PASS: safe opt-in Kokoro G2P/ONNX/WAV/IPC breakdown, no audio or model changes, off in daily and QA launchers')
