import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isComplexSpokenTurn, complexVoiceHoldMs,
  complexVoiceTokenBudget, shouldProtectWhisperCommandAtExpiry,
} from '../src/lib/complex-voice-turn'
import { isComplexVoicePrompt, COMPLEX_VOICE_INSTRUCTION } from '../bridge/orbia/complex-voice-intent.mjs'

const simple='Lumi, ¿cómo estás?'
const many='¿Qué es un BESS? ¿Qué hace el BMS? ¿Y qué significa SOC?'
const long='Lumi, quiero entender por qué hay dos cosas distintas, una es la batería y otra el inversor, primero explícamelo con ejemplos y después dime qué debería revisar si el equipo deja de mostrar datos en la pantalla de monitoreo del sistema, por favor'
assert.equal(isComplexSpokenTurn(simple),false)
assert.equal(isComplexVoicePrompt(simple),false)
assert.equal(isComplexSpokenTurn(many),true)
assert.equal(isComplexVoicePrompt(many),true)
assert.equal(isComplexSpokenTurn(long),true)
assert.equal(isComplexVoicePrompt(long),true)
assert.equal(complexVoiceHoldMs(many,3,true),850)
assert.equal(complexVoiceHoldMs(many,1,true),450)
assert.equal(complexVoiceHoldMs(simple,1,true),450)
assert.equal(complexVoiceHoldMs(many,3,false),0)
assert.equal(complexVoiceTokenBudget(many,true),320)
assert.equal(complexVoiceTokenBudget(simple,true),null)
assert.match(COMPLEX_VOICE_INSTRUCTION,/preguntas comprensibles/)
assert.match(COMPLEX_VOICE_INSTRUCTION,/UNA aclaración concreta/)
assert.match(COMPLEX_VOICE_INSTRUCTION,/No inventes/)
assert.equal(shouldProtectWhisperCommandAtExpiry({
  enabled:true, authorized:true, hasPending:true, expiredByMs:1000,
}),true)
for(const x of [
  {enabled:false,authorized:true,hasPending:true,expiredByMs:500},
  {enabled:true,authorized:false,hasPending:true,expiredByMs:500},
  {enabled:true,authorized:true,hasPending:false,expiredByMs:500},
  {enabled:true,authorized:true,hasPending:true,expiredByMs:12000},
  {enabled:true,authorized:true,hasPending:true,expiredByMs:-5},
]) assert.equal(shouldProtectWhisperCommandAtExpiry(x),false)
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const app=read('src/App.tsx')
const voice=read('src/lib/voice.ts')
const brain=read('bridge/ollama.mjs')
const launch=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const focused=read('src/lib/voice-focus.ts')
assert.match(app,/if \(store\.getState\(\)\.phase !== 'listening'\) return/)
assert.match(app,/voice\.current\?\.hasPendingCommand\?\.\(\)/)
assert.match(app,/commandExpiryAt\.current/)
assert.match(app,/setTimeout\(expireListening, 400\)/)
assert.match(app,/shouldProtectWhisperCommandAtExpiry\(/)
assert.match(voice,/transcribingCommandEpoch === captureEpoch/)
assert.match(voice,/item\.capturedMode === 'command'/)
assert.match(voice,/complexVoiceHoldMs\(text, count, true\)/)
assert.match(voice,/assemble\.held\(\)/)
assert.match(voice,/queueLimit = COMPLEX_VOICE_ENABLED && capturedMode === 'command' \? 6 : 4/)
assert.match(voice,/if \(mode === 'wake'\) \{\s*assemble\.cancel\(\)/)
assert.match(focused,/capturedMode === 'command'\) return currentMode !== 'command'/)
assert.match(brain,/COMPLEX_VOICE_INSTRUCTION/)
assert.match(brain,/runStructured\(messages, complexVoice \? 320 : OLLAMA_VOICE_NUM_PREDICT\)/)
assert.match(launch,/set "VITE_LUMIA_COMPLEX_VOICE_VQ01=1"/)
assert.match(launch,/set "ORBIA_LUMIA_COMPLEX_VOICE_VQ01=1"/)
console.log('LUMIA VQ-01: fast multi-question coherence, bounded authorized rescue, strict background isolation PASS')
