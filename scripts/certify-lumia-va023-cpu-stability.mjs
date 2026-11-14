import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {VA023_ORDER,summarizeVa023} from './lumia-kokoro-cpu-stability-va023.mjs'
import {validateVa022Candidate} from './lumia-kokoro-cpu-ab-va022.mjs'

assert.deepEqual(VA023_ORDER,['auto','4','4','auto'])
const block=(profile,p50,shift=0)=>({
  profile,p50Ms:p50,
  observations:Array.from({length:8},(_,i)=>({
    elapsedMs:p50+shift+i*0.1,wavBytes:100000+i,
    phrase:(i%4)+1,round:Math.floor(i/4)+1,
  })),
})
const stable=[
  block('auto',1200),block('4',1050),
  block('4',1050),block('auto',1200),
]
const first=summarizeVa023(stable)
assert.equal(first.stableReference,true)
assert.equal(first.candidateForMoreTesting,true)
assert.equal(first.autoDriftPct,0)
assert.ok(first.changePct < -10)
assert.equal(first.auto.p50Ms,1200.3)
assert.equal(first.four.p50Ms,1050.3)

const modest=summarizeVa023([
  block('auto',1200),block('4',1195),
  block('4',1195),block('auto',1200),
])
assert.equal(modest.candidateForMoreTesting,false)
assert.equal(modest.stableReference,true)

const unstable=summarizeVa023([
  block('auto',1100),block('4',1200),
  block('4',1200),block('auto',1400),
])
assert.equal(unstable.stableReference,false)
assert.equal(unstable.candidateForMoreTesting,false)
assert.ok(unstable.autoDriftPct>15)
assert.throws(()=>summarizeVa023([]),/VA023_INVALID_BLOCKS/)
assert.throws(()=>summarizeVa023([
  block('4',1000),...stable.slice(1),
]),/VA023_INVALID_BLOCKS/)
assert.throws(()=>summarizeVa023([
  {...stable[0],observations:[]},...stable.slice(1),
]),/VA023_INVALID_BLOCKS/)
assert.equal(validateVa022Candidate({threads:'4',providers:['CPUExecutionProvider']},'4'),true)
assert.equal(validateVa022Candidate({threads:'4',providers:['CUDAExecutionProvider']},'4'),false)

const source=readFileSync(fileURLToPath(new URL('./lumia-kokoro-cpu-stability-va023.mjs',import.meta.url)),'utf8')
const original=readFileSync(fileURLToPath(new URL('../INICIAR_LUMIA_ASUS_RAPIDA.cmd',import.meta.url)),'utf8')
const qa=readFileSync(fileURLToPath(new URL('../INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd',import.meta.url)),'utf8')
assert.match(source,/auditQaCheckout\(\{original,qa\}\)/)
assert.match(source,/makeVoiceQaChildEnv\(original\)/)
assert.match(source,/stopResidentKokoroVa022\(env\)/)
assert.match(source,/validateVa022Candidate\(residentKokoroVa022Info\(\),profile\)/)
assert.match(source,/phrases:VA02_TEST_PHRASES/)
assert.match(source,/rounds:2/)
assert.match(source,/Math\.abs\(drift\)>15/)
assert.doesNotMatch(original,/ORBIA_VA022_CPU_AB|ORBIA_VA022_INTRA_THREADS/)
assert.doesNotMatch(qa,/ORBIA_VA022_CPU_AB|ORBIA_VA022_INTRA_THREADS/)
assert.doesNotMatch(source,/copyFileSync|writeFileSync|npm install|pip install|symlinkSync/)
console.log('VA-02.3 PASS: balanced A-B-B-A CPU repeatability, drift guard, no production/config changes')
