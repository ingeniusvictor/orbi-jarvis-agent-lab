import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { visualOptionsForModel } from '../bridge/orbia/vision-profile-amr021.mjs'
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const pilot=read('INICIAR_LUMIA_ASUS_VISION4096.cmd')
const stable=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const profile=read('bridge/orbia/vision-profile-amr021.mjs')
const bridge=read('bridge/ollama.mjs')
const dock=read('src/ui/LumiaModelDock.tsx')

// Certified baseline remains default in the unchanged original launcher.
// Opt-in script selects a single new brain, and checks it already exists locally.
assert.match(stable,/set "ORBIA_LUMIA_MODEL=qwen3\.5:2b-q4_K_M"/)
assert.match(stable,/set "JARVIS_OLLAMA_MODEL=qwen3\.5:2b-q4_K_M"/)
assert.match(stable,/if defined LUMIA_ASUS_MODEL_OVERRIDE/)
assert.match(stable,/set "ORBIA_LUMIA_MODEL=%LUMIA_ASUS_MODEL_OVERRIDE%"/)
assert.match(stable,/set "JARVIS_OLLAMA_MODEL=%LUMIA_ASUS_MODEL_OVERRIDE%"/)
assert.match(pilot,/ollama show qwen3\.5:4b-vision4096/)
assert.match(pilot,/if errorlevel 1/)
assert.match(pilot,/set "LUMIA_ASUS_MODEL_OVERRIDE=qwen3\.5:4b-vision4096"/)
assert.match(pilot,/set "JARVIS_OLLAMA_KEEP_ALIVE=30m"/)
assert.match(pilot,/call "%~dp0INICIAR_LUMIA_ASUS_RAPIDA\.cmd"/)
assert.doesNotMatch(pilot,/ollama\s+(pull|rm|create|stop)\b/i)
assert.doesNotMatch(stable,/set "ORBIA_LUMIA_MODEL=qwen3\.5:4b-vision4096"/)

const expectedVision={temperature:0,num_ctx:4096,num_predict:256}
assert.deepEqual(visualOptionsForModel('qwen3.5:4b-vision4096'),expectedVision)
assert.deepEqual(visualOptionsForModel('QWEN3.5:4B-VISION4096'),expectedVision)
assert.deepEqual(visualOptionsForModel('qwen3.5:4b-fast'),{temperature:0,num_ctx:2048,num_predict:256})
assert.deepEqual(visualOptionsForModel('qwen3.5:2b-q4_K_M'),expectedVision)
// The 32 GPU layers + 128 batch must be governed by the tested Modelfile.
assert.match(profile,/num_gpu=32, num_batch=128/)
assert.doesNotMatch(profile,/return\s*\{[^}]*num_gpu\s*:/)
assert.doesNotMatch(profile,/return\s*\{[^}]*num_batch\s*:/)
assert.match(bridge,/options: visualOptions/)
assert.match(bridge,/think: false/)
assert.match(bridge,/images: \[image\.data\]/)
assert.match(bridge,/inputTokens=\$\{Number\(packet\?\.prompt_eval_count/)
assert.match(bridge,/doneReason=/)
assert.match(dock,/controlLocalModel/)
console.log('AMR-02.2 PASS: opt-in unified vision4096 launcher; original 2B baseline preserved; visual context 4096; no API GPU/batch override, no model installs, 30m residency, offline dock unchanged')
