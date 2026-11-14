import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {
  ORIGINAL_ASUS_SHA,VQ03_BRANCH,
  resolveOriginalVoiceFiles,makeVoiceQaChildEnv,
} from './lumia-vq03-local-voice-qa.mjs'
import {probeLocalVoiceCapabilities} from '../bridge/orbia/local-voice-probe.mjs'

const root=join('C:','Users','test','LUMIA-ASUS')
const names=resolveOriginalVoiceFiles(root,{exists:()=>true}).required
const allPaths=new Set(Object.values(names))
assert.equal(allPaths.size,6)
assert.equal(names.sttModel.endsWith('ggml-base.bin'),true)
assert.equal(names.ttsModel.endsWith('kokoro-v1.0.onnx'),true)
assert.equal(names.ttsVoices.endsWith('voices-v1.0.bin'),true)
assert.ok(names.ttsScript.endsWith('bridge/runtime/kokoro/synthesize.py') ||
          names.ttsScript.endsWith('bridge\\runtime\\kokoro\\synthesize.py'))
const base={ORBIA_LUMIA_MODEL:'qwen3.5:2b-q4_K_M',ORBI_LOCAL_STT_COMMAND:'old'}
const result=makeVoiceQaChildEnv(root,base,{exists:p=>allPaths.has(p)})
assert.deepEqual(result.missing,[])
assert.equal(result.env.ORBI_LOCAL_STT_COMMAND,names.sttCommand)
assert.equal(result.env.ORBI_LOCAL_STT_MODEL,names.sttModel)
assert.equal(result.env.ORBI_LOCAL_TTS_PYTHON,names.ttsPython)
assert.equal(result.env.ORBI_LOCAL_TTS_SCRIPT,names.ttsScript)
assert.equal(result.env.ORBI_LOCAL_TTS_MODEL,names.ttsModel)
assert.equal(result.env.ORBI_LOCAL_TTS_VOICES,names.ttsVoices)
assert.equal(result.env.PYTHONDONTWRITEBYTECODE,'1')
assert.equal(result.env.ORBIA_LUMIA_MODEL,base.ORBIA_LUMIA_MODEL)
assert.equal(base.ORBI_LOCAL_STT_COMMAND,'old','do not mutate external environment')
assert.deepEqual(probeLocalVoiceCapabilities({
  env:result.env,exists:p=>allPaths.has(p)
}).stt.localAvailable,true)
assert.deepEqual(probeLocalVoiceCapabilities({
  env:result.env,exists:p=>allPaths.has(p)
}).tts.localAvailable,true)

const absent=makeVoiceQaChildEnv(root,base,{exists:p=>p!==names.ttsVoices})
assert.equal(absent.env,null)
assert.ok(absent.missing.includes('ttsVoices'))
const noWhisper=makeVoiceQaChildEnv(root,base,{exists:p=>p!==names.sttModel})
assert.equal(noWhisper.env,null)
assert.ok(noWhisper.missing.includes('sttModel'))

const file=readFileSync(fileURLToPath(new URL('./lumia-vq03-local-voice-qa.mjs',import.meta.url)),'utf8')
const launcher=readFileSync(fileURLToPath(new URL('../INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd',import.meta.url)),'utf8')
assert.match(file,/git\(src,'rev-parse','HEAD'\)/)
assert.match(file,/git\(dst,'status','--porcelain'\)/)
assert.match(file,/spawn\('cmd\.exe'/)
assert.match(file,/VOICE_ASSETS_NOT_FOUND_IN_ORIGINAL/)
assert.match(file,/lumia-private-avatar-assets-vq03\.mjs/)
assert.match(file,/probeLocalVoiceCapabilities/)
assert.match(launcher,/ORBIA_LUMIA_VRM_GROUNDING_VQ03=1/)
assert.match(launcher,/VITE_LUMIA_AVATAR_QA_VQ03=1/)
assert.equal(ORIGINAL_ASUS_SHA.length,40)
assert.ok(VQ03_BRANCH.includes('vq03'))
for(const disallowed of ['npm install','npm ci','git reset','git clean','git checkout','mklink','junction','symlinkSync','writeFileSync','cpSync','copyFileSync']){
  assert.ok(!file.includes(disallowed),'unexpected mutator in QA voice launcher: '+disallowed)
}
console.log('VQ-03.3 PASS: child-only Whisper/Kokoro references; no downloads, duplicates, production modifications; missing assets fail-closed')
