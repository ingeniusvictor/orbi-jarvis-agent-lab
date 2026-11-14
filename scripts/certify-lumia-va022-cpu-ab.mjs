import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {
  validateVa022Ready,residentKokoroVa022Info,stopResidentKokoroVa022,
} from '../bridge/orbia/resident-tts.mjs'
import {
  VA022_PROFILES,validateVa022Candidate,compareVa022Results,
} from './lumia-kokoro-cpu-ab-va022.mjs'

assert.deepEqual(VA022_PROFILES,['auto','2','4'])
const ok=validateVa022Ready({threads:'2',providers:['CPUExecutionProvider']})
assert.deepEqual(ok,{threads:'2',providers:['CPUExecutionProvider']})
assert.equal(validateVa022Candidate(ok,'2'),true)
assert.equal(validateVa022Candidate(ok,'4'),false)
assert.equal(validateVa022Candidate({threads:'2',providers:['CUDAExecutionProvider','CPUExecutionProvider']},'2'),false)
assert.equal(validateVa022Candidate({threads:'2',providers:[]},'2'),false)
assert.equal(validateVa022Ready({threads:'3',providers:['CPUExecutionProvider']}),null)
assert.equal(validateVa022Ready({threads:'2',providers:[]}),null)
assert.equal(validateVa022Ready({threads:'2',providers:['not-provider']}),null)
assert.equal(residentKokoroVa022Info(),null)
assert.equal(stopResidentKokoroVa022({}),false)
assert.equal(stopResidentKokoroVa022({ORBIA_VA022_CPU_AB:'1'}),false)

const sample=[
  {profile:'auto',p50Ms:1300,p95Ms:1700},
  {profile:'2',p50Ms:1100,p95Ms:1400},
  {profile:'4',p50Ms:1250,p95Ms:1600},
]
const compared=compareVa022Results(sample)
assert.deepEqual(compared.map(x=>x.changePct),[0,-15.4,-3.8])
assert.throws(()=>compareVa022Results([]),/VA022_BAD_RESULTS/)
assert.throws(()=>compareVa022Results([{profile:'2',p50Ms:3,p95Ms:4},...sample.slice(1)]),/VA022_BAD_RESULTS/)
const read=path=>readFileSync(fileURLToPath(new URL('../'+path,import.meta.url)),'utf8')
const worker=read('bridge/runtime/kokoro/resident.py')
const node=read('bridge/orbia/resident-tts.mjs')
const bench=read('scripts/lumia-kokoro-cpu-ab-va022.mjs')
const launcherDaily=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const launcherQA=read('INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd')

assert.match(worker,/CPU_AB_VA022 = os\.environ\.get\('ORBIA_VA022_CPU_AB'\) == '1'/)
assert.match(worker,/if CPU_AB_VA022 and THREAD_MODE_VA022 in \("2", "4"\):/)
assert.match(worker,/opts\.intra_op_num_threads = int\(THREAD_MODE_VA022\)/)
assert.match(worker,/Kokoro\.from_session\(session, str\(VOICES\)\)/)
assert.match(worker,/providers=\["CPUExecutionProvider"\]/)
assert.match(worker,/tts = Kokoro\(str\(MODEL\), str\(VOICES\)\)/)
assert.match(worker,/sf\.write\(target, audio, sample_rate, subtype="PCM_16"\)/)
assert.match(node,/validateVa022Ready\(msg\.va022\)/)
assert.match(node,/stopResidentKokoroVa022\(env = process\.env\)/)
assert.match(bench,/auditQaCheckout\(\{original:join\(homedir\(\),'LUMIA-ASUS'\),qa\}\)/)
assert.match(bench,/makeVoiceQaChildEnv\(join\(homedir\(\),'LUMIA-ASUS'\)\)/)
assert.match(bench,/stopResidentKokoroVa022\(env\)/)
assert.match(bench,/phrases:VA02_TEST_PHRASES,rounds:2/)
assert.doesNotMatch(launcherDaily,/ORBIA_VA022_CPU_AB|ORBIA_VA022_INTRA_THREADS/)
assert.doesNotMatch(launcherQA,/ORBIA_VA022_CPU_AB|ORBIA_VA022_INTRA_THREADS/)
for(const s of [worker,node,bench]){
  assert.doesNotMatch(s,/pip install|npm install|writeFileSync|copyFileSync|symlinkSync|uploadAudio/)
}
console.log('VA-02.2 PASS: optional CPU threads auto/2/4, verified CPU provider, same model/WAV, independent workers, no ASUS production mutation')
