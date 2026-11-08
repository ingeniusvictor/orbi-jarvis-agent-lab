import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const tts = read('src/lib/tts.ts')
const launcher = read('INICIAR_LUMIA_ASUS_2B_KOKORO_DIAGNOSTICO_AMR031.cmd')
const base = read('INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd')

assert.match(launcher, /VITE_LUMIA_KOKORO_TIMING_AMR031=1/)
assert.match(launcher, /INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030\.cmd/)
assert.match(base, /INICIAR_LUMIA_ASUS_RAPIDA\.cmd/)
assert.match(tts, /const KOKORO_TIMING_AMR031 = import\.meta\.env\.VITE_LUMIA_KOKORO_TIMING_AMR031 === '1'/)
assert.match(tts, /const pending = synthesise\(item\.text, item\)/)
assert.match(tts, /\(timing\) => \{ item\.localTiming = timing \}/)
assert.match(tts, /const headersMs = Date\.now\(\)/)
assert.match(tts, /const blobMs = Date\.now\(\)/)
assert.match(tts, /onTiming\?\.\(/)
assert.match(tts, /requestToHeadersMs/)
assert.match(tts, /headersToBlobMs/)
assert.match(tts, /serverSynthesisMs/)
assert.match(tts, /preparedBeforePlaybackMs/)
assert.match(tts, /if \(KOKORO_TIMING_AMR031 && item\.localTiming\)/)
assert.match(tts, /audioAbort\.abort\(\)/)
assert.match(tts, /prime\(queue\[0\]\)/)
assert.match(tts, /await speakOne\(item\)/)
assert.doesNotMatch(launcher, /ollama (?:pull|rm|stop|create)/)
assert.doesNotMatch(launcher, /VISION4096|VISION_GRUPOS/)
const check = spawnSync(process.execPath, [
  '--check',
  fileURLToPath(new URL('../bridge/orbia/vision-posture-selfcheck-amr030.mjs', import.meta.url)),
], { encoding: 'utf8' })
assert.equal(check.status, 0, check.stderr)
console.log('AMR-03.1 PASS: Kokoro timing is opt-in; existing audio queue, cancellation, voice, model and AMR-03.0 rollback remain intact')
