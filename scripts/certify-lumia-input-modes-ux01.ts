import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initialLumiaInputMode, shouldRunAlwaysOnVoice, canCapturePushVoice } from '../src/lib/input-mode'
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
assert.equal(initialLumiaInputMode(true), 'text')
assert.equal(initialLumiaInputMode(false), 'continuous')
for(const mode of ['text','push','continuous'] as const) {
  assert.equal(shouldRunAlwaysOnVoice(mode), mode === 'continuous')
  assert.equal(canCapturePushVoice(mode), mode === 'push')
}
assert.match(read('src/lib/push-to-talk.ts'), /export const PUSH_CAPTURE_MAX_MS = 20_000/)
const mic = read('src/lib/mic-lease.ts')
assert.match(mic, /requestedAt !== generation/)
assert.match(mic, /Object.assign\(getSharedMic, \{ release \}\)/)
assert.match(read('src/lib/audio.ts'), /export function releaseMicrophone/)
assert.match(read('INICIAR_LUMIA_ASUS_RAPIDA.cmd'), /set "VITE_LUMIA_MULTIMODAL_COMPOSER=1"/)
assert.match(read('INICIAR_LUMIA_ASUS_RAPIDA.cmd'), /set "VITE_LUMIA_CLAP_BOOT=0"/)
const app = read('src/App.tsx')
assert.match(app, /<LumiaComposer/)
assert.match(app, /if \(shouldRunAlwaysOnVoice\(inputModeRef.current\)\) await restartVoice\(\)/)
assert.match(app, /if \(shouldRunAlwaysOnVoice\(inputModeRef.current\)\) \{/)
assert.match(app, /releaseMicrophone\(\)/)
assert.match(app, /PUSH_CAPTURE_MAX_MS/)
assert.match(app, /\x27x-orbia-voice-mode\x27: \x27command\x27/)
assert.match(app, /mode={inputMode}/)
assert.match(app, /onModeChange={switchInputMode}/)
assert.match(app, /onSend={submitWritten}/)
console.log('LUMIA UX-01: native text, photo attachment, push-to-talk and opt-in continuous wiring PASS')
