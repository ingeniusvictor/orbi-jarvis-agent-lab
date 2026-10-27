import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  dateLabel, timeLabel, elapsedLabel, turnStateLabel, exportConversationTimeline,
} from '../src/lib/conversation-timeline'
import type { HeardLine, Turn } from '../src/store'

const base = new Date('2026-10-27T20:00:00.123-03:00').getTime()
const after = base + 39620
assert.match(dateLabel(base), /2026/)
assert.match(timeLabel(base), /\d{2}:\d{2}:\d{2}\.\d{3}/)
assert.equal(elapsedLabel(base, base + 382), '382 ms')
assert.equal(elapsedLabel(base, after), '39.62 s')
assert.equal(elapsedLabel(base, base - 10), '—')
assert.equal(timeLabel(undefined), '—')

const user: Turn = { id: 'u1', role: 'user', text: 'Lumi, dime la hora', at: base }
const waiting: Turn = { id: 'a1', role: 'jarvis', text: '', at: base, status: 'pending' }
assert.equal(turnStateLabel(waiting, base + 100), 'ESPERANDO RESPUESTA')
assert.equal(turnStateLabel(waiting, base + 15999), 'DEMORA · SIN TEXTO')
assert.equal(turnStateLabel({ ...waiting, status: 'error' }, after), 'ERROR')
assert.equal(turnStateLabel({ ...waiting, status: 'no-response' }, after), 'SIN RESPUESTA')
assert.equal(turnStateLabel({ ...waiting, status: 'interrupted' }, after), 'INTERRUMPIDA')
assert.equal(turnStateLabel({ ...waiting, status: 'complete' }, after), 'COMPLETA')

const failed: Turn = {
  ...waiting, status: 'error', finishedAt: after,
  errorNote: 'Bridge response failed (test)',
}
const speaking: Turn = {
  ...waiting, text: 'La hora es…', firstTextAt: base + 36000,
  firstAudioAt: base + 39000, finishedAt: base + 42000, status: 'complete',
}
const heard: HeardLine[] = [{
  id: 'h1', text: 'Lumi, dime la hora', mode: 'command',
  provider: 'whisper-local', at: base - 4400, sttMs: 4200,
  kind: 'speech', wakeMatched: true,
}]
const result = exportConversationTimeline({
  heard, turns: [user, speaking, failed], at: base + 43000,
  error: 'Bridge caído durante segunda pregunta', errorAt: after,
})
assert.match(result, /STT 4200 ms/)
assert.match(result, /39\.00 s/)
assert.match(result, /36\.00 s/)
assert.match(result, /Error: Bridge response failed \(test\)/)
assert.match(result, /LUMIA \[ERROR\]/)
assert.match(result, /ERROR GENERAL \[/)
assert.match(result, /Bridge caído durante segunda pregunta/)
assert.match(result, /Primer texto:/)
assert.match(result, /Reproducción iniciada:/)
assert.ok(!result.includes('OPENAI_API_KEY'))

const hud = readFileSync(new URL('../src/ui/Hud.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const store = readFileSync(new URL('../src/store.ts', import.meta.url), 'utf8')
const voice = readFileSync(new URL('../src/lib/voice.ts', import.meta.url), 'utf8')
assert.match(hud, /conversation-date-bar/)
assert.match(hud, /COPIAR REGISTRO/)
assert.match(hud, /navigator\.clipboard\.writeText/)
assert.match(hud, /timeLabel\(line\.at\)/)
assert.match(hud, /timeLabel\(turn\.at\)/)
assert.match(hud, /turnStateLabel\(turn, now\)/)
assert.match(hud, /turn\.firstAudioAt/)
assert.match(hud, /turn\.errorNote/)
assert.match(store, /appendToTurn: \(id, delta\)/)
assert.match(store, /updateTurn: \(id, patch\)/)
assert.match(voice, /sttMs: Math\.max\(0, Math\.round\(performance\.now\(\) - t0\)\)/)
assert.match(app, /s\.pushTurn\(\{ id: turnId, role: 'jarvis', text: '', at: acceptedAt, status: 'pending' \}\)/)
assert.match(app, /store\.getState\(\)\.updateTurn\(turnId, \{\s*status: 'complete'/)
assert.match(app, /status: 'no-response'/)
assert.match(app, /status: 'error', finishedAt: Date\.now\(\), errorNote: failure/)
assert.match(app, /store\.getState\(\)\.appendToTurn\(turnId, delta\)/)
assert.ok(app.indexOf("status: 'pending'") < app.indexOf('await ask(said'),
  'Pending entry must appear before the model request begins.')

console.log('LUMIA TL-01 timed two-lane transcript: PASS')
console.log('40s model waits, first text, initial audio and per-turn failures are traceable: PASS')
console.log('No real Windows latency proven until user tests locally.')
