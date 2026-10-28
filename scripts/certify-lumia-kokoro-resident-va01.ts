import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const worker = read('bridge/runtime/kokoro/resident.py')
const manager = read('bridge/orbia/resident-tts.mjs')
const voice = read('bridge/orbia/local-tts.mjs')
const bridge = read('bridge/server.mjs')
const tts = read('src/lib/tts.ts')
const app = read('src/App.tsx')
const store = read('src/store.ts')
const hud = read('src/ui/Hud.tsx')
const copied = read('src/lib/conversation-timeline.ts')
const avatar = read('src/scene/LumiaAvatar.tsx')

assert.match(worker, /tts = Kokoro\(str\(MODEL\), str\(VOICES\)\)/)
assert.match(worker, /for raw in sys\.stdin:/)
assert.match(worker, /ORBI_LOCAL_TTS_MODEL/)
assert.match(worker, /ORBI_LOCAL_TTS_VOICES/)
assert.match(worker, /json\.dumps\(payload, ensure_ascii=False\)/)
assert.match(worker, /sf\.write\(target, audio, sample_rate, subtype="PCM_16"\)/)
assert.ok(worker.indexOf('tts = Kokoro') < worker.indexOf('for raw in sys.stdin:'),
  'ONNX must be initialized before reading any sentence, exactly once.')

assert.match(manager, /MAX_PENDING_BYTES = 64 \* 1024/)
assert.match(manager, /const MAX_AUDIO_BYTES = 15 \* 1024 \* 1024/)
assert.match(manager, /ORBI_LOCAL_TTS_MODEL: paths\.kokoroModel/)
assert.match(manager, /ORBI_LOCAL_TTS_VOICES: paths\.kokoroVoices/)
assert.match(manager, /if \(starting\) return starting/)
assert.match(manager, /const task = fifo\.then/)
assert.match(manager, /failResident\(state, new Error\('Kokoro resident synthesis timeout'\)\)/)
assert.match(manager, /process\.once\('exit'/)
assert.match(manager, /env\.ORBIA_KOKORO_RESIDENT_ENABLED !== '1'/)
assert.match(voice, /if \(env\.ORBIA_KOKORO_RESIDENT_ENABLED === '1'\)/)
assert.match(voice, /synthesizeResidentKokoro\(input/)
assert.match(voice, /const \{ kokoroPython, kokoroScript \} = localVoicePaths\(env\)/)
assert.ok(voice.indexOf('synthesizeResidentKokoro(input') < voice.indexOf('const { kokoroPython, kokoroScript }'),
  'One-shot certified synthesis remains the fallback.')
assert.match(bridge, /void prewarmResidentKokoro\(\)/)
assert.match(bridge, /x-orbia-tts-synthesis-ms/)
assert.match(tts, /localSynthesisMs: null as number \| null/)
assert.match(tts, /notifyPhraseStart\(text\)/)
assert.match(app, /pushSpokenSegment\(turnId, phrase\)/)
assert.match(store, /pushSpokenSegment: \(id, segment\)/)
assert.match(hud, /Voz #\{index \+ 1\}/)
assert.match(copied, /Audio #\$\{index \+ 1\}/)
assert.match(avatar, /const FACE_HEIGHT_FRACTION = 0\.47/)
assert.match(avatar, /const FACE_SHIFT_PX = 25/)

// Parse Node module syntax without starting a voice worker or spending tokens.
const check = spawnSync(process.execPath, ['--check', new URL('../bridge/orbia/resident-tts.mjs', import.meta.url).pathname], { encoding: 'utf8' })
assert.equal(check.status, 0, check.stderr)

console.log('LUMIA VA-01: owner-gated persistent Kokoro architecture: PASS')
console.log('One-shot fallback and phrase-level audio gap telemetry: PASS')
console.log('AV-01B committed avatar profile preserved; exact local Windows adjustment must be recovered separately.')
console.log('Real speedup requires a Windows comparison. No performance result is assumed.')
