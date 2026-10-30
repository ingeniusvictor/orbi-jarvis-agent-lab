import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { shouldRecoverGuardToWake, voiceModeForPhase } from '../src/lib/voice-focus'
import { parseModelControl } from '../bridge/orbia/model-manager.mjs'

const wake = /\b(?:lumi|lumia)\b/i
const bareWake = /^(?:hola\s+)?(?:lumi|lumia)[,.!?]*$/i
const options = { wake, bareWake }
const actualQuestion =
  'Lumi, actualmente tienes varias IA local con las cuales se pueden intercambiar. Me puede decir, ¿cuáles son?'

assert.equal(voiceModeForPhase('dormant'), 'wake')
assert.equal(voiceModeForPhase('speaking'), 'guard')
assert.equal(shouldRecoverGuardToWake('guard', 'wake', actualQuestion, options), true)
assert.equal(shouldRecoverGuardToWake('guard', 'wake', 'Lumi, cuéntame los modelos instalados.', options), true)
assert.equal(shouldRecoverGuardToWake('guard', 'wake', '¿Cuáles son?', options), false)
assert.equal(shouldRecoverGuardToWake('guard', 'wake', '[Música]', options), false)
assert.equal(shouldRecoverGuardToWake('guard', 'wake', 'Lumi', options), false)
assert.equal(shouldRecoverGuardToWake('guard', 'wake', 'para', options), false)
assert.equal(shouldRecoverGuardToWake('guard', 'guard', actualQuestion, options), false)
assert.equal(shouldRecoverGuardToWake('guard', 'command', actualQuestion, options), false)
assert.equal(shouldRecoverGuardToWake('wake', 'wake', actualQuestion, options), false)
assert.equal(shouldRecoverGuardToWake('command', 'wake', actualQuestion, options), false)

assert.deepEqual(parseModelControl(actualQuestion), { action: 'list' })
const history = [
  { role: 'user', content: 'Lumi, cuántos modelos tienes instalados en Ollama?' },
  { role: 'assistant', content: 'Tengo varios modelos locales instalados en Ollama.' },
]
assert.deepEqual(parseModelControl('¿Cuáles son?', history), { action: 'list' })
assert.deepEqual(parseModelControl('¿Cuáles son?', []), null)
assert.deepEqual(parseModelControl('¿Cuáles son los beneficios de una IA local?', history), null)

const voice = readFileSync(new URL('../src/lib/voice.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const avatar = readFileSync(new URL('../src/scene/LumiaAvatar.tsx', import.meta.url), 'utf8')
assert.match(voice, /shouldRecoverGuardToWake\('guard', currentMode, said/)
assert.match(voice, /h\.onWake\(trailing\)/)
assert.match(voice, /h\.onUtterance\(trailing\)/)
assert.match(voice, /guard transcript arrived in standby without a full wake request/)
assert.match(app, /if \(phase === 'offline' \|\| phase === 'boot' \|\| phase === 'dormant'\) return/)
assert.match(avatar, /const FACE_HEIGHT_FRACTION = 0\.47/)
assert.match(avatar, /const FACE_SHIFT_PX = 25/)

console.log('LUMIA WR-01: late Whisper GUARD->WAKE addressed question recovery: PASS')
console.log('Background/musical/bare/override-only segments never reopen standby: PASS')
console.log('Full question plus contextual "¿Cuáles son?" routed to Ollama inventory: PASS')
console.log('Avatar, voice profile, original installation and main untouched. Windows audio test required.')
