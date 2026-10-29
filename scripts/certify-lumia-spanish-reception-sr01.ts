import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeContextualEverydaySpeechText } from '../bridge/orbia/speech-vocabulary.mjs'
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

// Grounded in anonymized real owner reports: distinct noisy conversational
// outputs must not be globally rewritten by a dictionary.
const cases: Array<[string, string]> = [
  ['Vamos a hacer una arriba.', 'Vamos a hacer una arepa.'],
  ['Después, quiero hacer una arriba.', 'Después, quiero hacer una arepa.'],
  ['Cómo hacer una repa venezolana.', 'Cómo hacer una arepa venezolana.'],
  ['Quiero preparar una repa.', 'Quiero preparar una arepa.'],
  ['Una repa llanera', 'Una arepa llanera'],
  ['Quiero saber cómo hacer una agarriba.', 'Quiero saber cómo hacer una arepa.'],
  ['Lumi, quiero saber cómo hacer una haripa.', 'Lumi, quiero saber cómo hacer una arepa.'],
  ['¿Cómo preparar una aripa venezolana?', '¿Cómo preparar una arepa venezolana?'],
  ['Qué tipos de rellenos se pueden utilizar en la ARIPA.', 'Qué tipos de rellenos se pueden utilizar en la arepa.'],
  ['Qué tipos de rellenos se pueden utilizar en la haripa.', 'Qué tipos de rellenos se pueden utilizar en la arepa.'],
  ['Lumidime 5 formas de trabajar con IA.', 'Lumi, dime 5 formas de trabajar con IA.'],
  ['Lumidime cómo preparar una arepa.', 'Lumi, dime cómo preparar una arepa.'],
  ['Lumi dime 5 formas de trabajar.', 'Lumi dime 5 formas de trabajar.'],
  ['Lumidime es el nombre de un negocio.', 'Lumidime es el nombre de un negocio.'],
  ['Lumi, no es ARIPA, es AREPA venezolana.', 'Lumi, no es ARIPA, es AREPA venezolana.'],
  ['Las piezas están arriba.', 'Las piezas están arriba.'],
  ['Cocinar una parrilla', 'Cocinar una parrilla'],
  ['Trabajé en la Haripa', 'Trabajé en la Haripa'],
  ['¿Puedes decirme cómo cocinar una arepa?', '¿Puedes decirme cómo cocinar una arepa?'],
  ['Pon la olla arriba.', 'Pon la olla arriba.'],
  ['Pondré una arriba de otra.', 'Pondré una arriba de otra.'],
  ['El motor está arriba.', 'El motor está arriba.'],
  ['Haz una reparación arriba.', 'Haz una reparación arriba.'],
  ['Y la comable.', 'Y la comable.'],
  ['Vaca más que el brazo del brazo quieto.', 'Vaca más que el brazo del brazo quieto.'],
  ['[Música]', '[Música]'],
]
for (const [input, expected] of cases) {
  assert.equal(normalizeContextualEverydaySpeechText(input), expected, input)
}
const launcher = read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const audio = read('src/lib/audio.ts')
const local = read('bridge/orbia/local-stt.mjs')
const voice = read('src/lib/voice.ts')
assert.match(launcher, /set "VITE_LUMIA_NEAR_FIELD_FOCUS=0"/)
assert.match(launcher, /set "VITE_LUMIA_LONG_QUESTION_INPUT=1"/)
assert.match(audio, /autoGainControl: !NEAR_FIELD_FOCUS/)
assert.match(audio, /noiseSuppression: true/)
assert.match(audio, /echoCancellation: true/)
assert.match(local, /normalizeContextualEverydaySpeechText/)
assert.match(local, /normalizeTechnicalSpeechText/)
assert.match(read('bridge/server.mjs'), /initialPrompt: voiceMode === 'command' \? undefined : ''/)
assert.match(voice, /shouldDeferLongQuestion/)
console.log('LUMIA SR-01: normal AGC restored, wake protection retained, narrow Spanish repair PASS')
