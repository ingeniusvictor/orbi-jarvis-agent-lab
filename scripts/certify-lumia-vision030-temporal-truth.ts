import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { requiresFreshVisualObservation, frozenVisualTruthReply } from '../src/lib/vision-temporal-vi030'

const yes = [
  'Lumi, ¿qué cambió en la escena?',
  '¿Y qué está pasando ahora?',
  'Lumi, ¿sigue ahí la persona?',
  '¿Ha cambiado la posición de la persona?',
  '¿Se movió el objeto?',
  '¿Sigue igual?',
  '¿Qué ves ahora?',
  '¿Todavía hay una persona frente a la cámara?',
]
for (const value of yes) {
  assert.equal(requiresFreshVisualObservation(value), true, 'temporal: '+value)
}

const no = [
  '¿Qué hay detrás de la persona en la fotografía?',
  'Lumi, describe esta foto.',
  'Lumi, ¿de qué color es esa camisa?',
  '¿Qué hora es ahora?',
  '¿Sigue funcionando Ollama?',
  'Lumi, mira esto.',
  'Lumi, ¿qué tiempo hará mañana?',
  'Necesito un resumen del código de ahora.',
  '',
]
for (const value of no) {
  assert.equal(requiresFreshVisualObservation(value), false, 'non temporal: '+value)
}
const camera = frozenVisualTruthReply('camera')
const file = frozenVisualTruthReply('file')
assert.match(camera, /fotograma congelado/i)
assert.match(camera, /no puedo saber/i)
assert.match(camera, /no encender[eé] la c[aá]mara/i)
assert.match(file, /fotograf[ií]a fija/i)
assert.match(file, /selecciona otra imagen/i)

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.match(app, /requiresFreshVisualObservation\(said\)/)
assert.match(app, /forceVisualFollowUp \|\| resolvingReference \|\| temporalQuestion/)
assert.match(app, /if\(temporalQuestion && visualFollowUp\)/)
assert.match(app, /contextualReply=frozenVisualTruthReply/)
assert.ok(app.indexOf('if(temporalQuestion && visualFollowUp)') < app.indexOf("if(contextAction==='clarify-reference')"), 'temporal guard takes priority')
assert.match(app, /captureLumiaAuthorizedStill\(stale,undefined,route\.resolution\)/)
assert.match(app, /setCameraPreviewOpen\(false\)/)

const viewer = readFileSync(new URL('../src/ui/LumiaCameraViewfinder.tsx', import.meta.url), 'utf8')
assert.match(viewer, /onCaptured\(image,effectiveResolution\)/)
assert.match(viewer, /releaseRef\.current\?\.\(\)/)
assert.match(viewer, /90_000/)
console.log('VI-03.0 PASS: stale-frame temporal assertions blocked, fresh capture explicit, ordinary vision and camera permissions unchanged')
