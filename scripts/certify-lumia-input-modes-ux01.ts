import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initialLumiaInputMode, shouldRunAlwaysOnVoice, canCapturePushVoice } from '../src/lib/input-mode'
import { PUSH_CAPTURE_MAX_MS } from '../src/lib/push-to-talk'
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
assert.equal(initialLumiaInputMode(true), 'text')
assert.equal(initialLumiaInputMode(false), 'continuous')
for(const mode of ['text','push','continuous'] as const) {
  assert.equal(shouldRunAlwaysOnVoice(mode), mode === 'continuous')
  assert.equal(canCapturePushVoice(mode), mode === 'push')
}
assert.equal(PUSH_CAPTURE_MAX_MS, 20000)
const mic = read('src/lib/mic-lease.ts')
assert.match(mic, /requestedAt !== generation/)
assert.match(mic, /Object.assign\(getSharedMic, \{ release \}\)/)
assert.match(read('src/lib/audio.ts'), /export function releaseMicrophone/)
assert.match(read('INICIAR_LUMIA_ASUS_RAPIDA.cmd'), /set "VITE_LUMIA_MULTIMODAL_COMPOSER=1"/)
assert.match(read('INICIAR_LUMIA_ASUS_RAPIDA.cmd'), /set "VITE_LUMIA_CLAP_BOOT=0"/)
console.log('LUMIA UX-01: text native, explicit mic release and push capture bounds PASS')
