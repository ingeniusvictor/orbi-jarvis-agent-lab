import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  BASELINE_VAD_SILENCE_MS,
  chooseAcousticSilenceMs,
  decideTextTurnHold,
} from '../src/lib/adaptive-turn'

// Default behavior must remain unchanged for both provider families.
for (const [text, baselineMs] of [
  ['sí', 1600],
  ['sí, pero', 1600],
  ['necesito información sobre', 1600],
  ['Explícame el estado del proyecto en detalle', 250],
  ['Una pregunta completa.', 0],
] as const) {
  assert.equal(
    decideTextTurnHold({ text, baselineMs, settleMs: 250, continueMs: 1600, enabled: false }).holdMs,
    baselineMs,
    'Owner opt-in must be required for adaptive text policy.',
  )
}

// A fully endpointed short acknowledgement should not pay another 1.6–2.4s
// of *additional* text-assembler delay after local/browser recognition.
for (const text of ['sí', 'listo', 'dale', 'perfecto', 'continúa', 'de acuerdo', 'gracias', 'ok']) {
  const result = decideTextTurnHold({
    text, baselineMs: 2400, settleMs: 300, continueMs: 2400,
    enabled: true, segments: 1,
  })
  assert.deepEqual(result, { holdMs: 0, reason: 'brief-reply' })
}

// Partial answers, ambiguous prompts and trailing connectors must keep
// their legacy wait, so natural speech is not broken by aggressive streaming.
for (const text of ['sí, pero', 'listo, ahora', 'continúa con', 'me gustaría que', 'dale, por favor,', 'sí,']) {
  const result = decideTextTurnHold({
    text, baselineMs: 2400, settleMs: 300, continueMs: 2400,
    enabled: true, segments: 1,
  })
  assert.equal(result.holdMs, 2400, text)
  assert.equal(result.reason, 'baseline', text)
}

assert.equal(
  decideTextTurnHold({
    text: 'listo', baselineMs: 2400, settleMs: 300, continueMs: 2400,
    enabled: true, segments: 2,
  }).holdMs,
  2400,
  'Do not hasten a multipart utterance.',
)
assert.deepEqual(
  decideTextTurnHold({
    text: 'Lumia, necesito revisar esto...', baselineMs: 0,
    settleMs: 250, continueMs: 1600, enabled: true,
  }),
  { holdMs: 1600, reason: 'unfinished-ellipsis' },
)
assert.deepEqual(
  decideTextTurnHold({
    text: 'Esto es el final de la frase.', baselineMs: 0,
    settleMs: 250, continueMs: 1600, enabled: true,
  }),
  { holdMs: 0, reason: 'baseline' },
)
const longThought = decideTextTurnHold({
  text: 'Necesito analizar los resultados de las pruebas para planificar la siguiente versión',
  baselineMs: 300, settleMs: 300, continueMs: 2400, enabled: true,
})
assert.equal(longThought.holdMs, 230)
assert.equal(longThought.reason, 'long-thought')
assert.equal(
  decideTextTurnHold({
    text: 'Necesito analizar los resultados de las pruebas para planificar la siguiente versión',
    baselineMs: 300, settleMs: 300, continueMs: 2400,
    enabled: true, segments: 2,
  }).holdMs,
  300,
)
assert.equal(
  decideTextTurnHold({
    text: 'vale', baselineMs: Number.NaN, settleMs: 250,
    continueMs: 1600, enabled: true,
  }).reason,
  'baseline',
)

// Existing acoustic window unchanged unless *local* VAD calls it in opt-in
// command mode. The function itself cannot grant that authority.
assert.equal(BASELINE_VAD_SILENCE_MS, 650)
assert.equal(chooseAcousticSilenceMs({ voicedDurationMs: 4000 }), 650)
assert.equal(chooseAcousticSilenceMs({ voicedDurationMs: 4000, adaptive: true, guarded: true }), 650)
assert.equal(chooseAcousticSilenceMs({ voicedDurationMs: Number.NaN, adaptive: true }), 650)
assert.equal(chooseAcousticSilenceMs({ voicedDurationMs: -50, adaptive: true }), 650)
assert.equal(chooseAcousticSilenceMs({ voicedDurationMs: 280, adaptive: true }), 780)
assert.equal(chooseAcousticSilenceMs({ voicedDurationMs: 799, adaptive: true }), 780)
assert.equal(chooseAcousticSilenceMs({ voicedDurationMs: 800, adaptive: true }), 650)
assert.equal(chooseAcousticSilenceMs({ voicedDurationMs: 2499, adaptive: true }), 650)
assert.equal(chooseAcousticSilenceMs({ voicedDurationMs: 2500, adaptive: true }), 580)
assert.equal(chooseAcousticSilenceMs({ voicedDurationMs: 8000, adaptive: true }), 580)

// Structural checks are not a substitute for hardware testing, but ensure
// the intended safe integration does not drift from the certified design.
const voice = readFileSync(new URL('../src/lib/voice.ts', import.meta.url), 'utf8')
const vad = readFileSync(new URL('../src/lib/vad.ts', import.meta.url), 'utf8')
assert.match(voice, /VITE_LUMIA_ADAPTIVE_TURNS\s*===\s*'1'/)
assert.match(voice, /provider === 'local' && h\.mode\(\) === 'command'/)
assert.match(voice, /enabled: timing\.adaptive/)
assert.match(vad, /: SILENCE_MS/)
assert.match(vad, /guarded: guard/)
assert.match(vad, /h\.suppress\?\.\(\)/)

console.log('LUMIA VL-03 adaptive turn text and local acoustic contract: PASS')
console.log('Defaults, partial speech, echo guard, owner opt-in and brief replies: PASS')
console.log('Manual mic/Whisper/browser latency and false barge-in tests: NOT PERFORMED')
