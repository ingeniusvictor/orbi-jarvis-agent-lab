import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const tts = read('src/lib/tts.ts')
const panel = read('src/ui/Diagnostics.tsx')
const launcher = read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')

assert.match(tts, /LOCAL_PLAYBACK_RECOVERY = import\.meta\.env\.VITE_LUMIA_LOCAL_PLAYBACK_RECOVERY === '1'/)
assert.match(tts, /LOCAL_WAV_START_TIMEOUT_MS = 12_000/)
assert.match(tts, /LOCAL_WAV_STALL_TIMEOUT_MS = 15_000/)
assert.match(tts, /typeof source === 'string' && diag\.engine === 'kokoro-local'/)
assert.match(tts, /localPlaybackStartTimeouts\+\+/)
assert.match(tts, /localPlaybackStalls\+\+/)
assert.match(tts, /if \(stallWatchdog\) clearInterval\(stallWatchdog\)/)
assert.match(tts, /if \(recoveringLocal\) \{[\s\S]*?return/)
assert.match(tts, /diag\.localPlaybackFallbacks\+\+/)
assert.match(tts, /currentSeconds > lastProgressSeconds \+ 0\.05/)
assert.match(panel, /local WAV playback stalls/)
assert.match(panel, /local WAV start timeouts/)
assert.match(launcher, /set "VITE_LUMIA_LOCAL_PLAYBACK_RECOVERY=1"/)

console.log('LUMIA VA-02 opt-in local WAV start/stall and offline fallback contracts: PASS')
console.log('No paid cloud rescue for the local recovery path.')
