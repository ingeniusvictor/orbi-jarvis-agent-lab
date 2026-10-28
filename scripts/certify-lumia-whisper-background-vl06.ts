import assert from 'node:assert/strict'
import { isNonSpeechTranscript } from '../src/lib/voice-focus'

// Real Windows diagnostics showed Whisper returning many music annotations
// inside ONE segment. Such transcripts are not commands, even when repeated.
const background = [
  '[Música]', '[Musica]', '[Aplausos]', 'música', '(Music)',
  '[Música] [Música]', '[Música] [Música] [Música]',
  '[Música][Música]', '[Aplausos] [Música]',
  '[Music], [Noise].', '[Risas] [Silencio]',
]
for (const said of background) {
  assert.equal(isNonSpeechTranscript(said), true, 'Pure acoustic noise: ' + said)
}

// Never mistake actual speech about music for meaningless annotations.
const validSpeech = [
  'Lumi, ¿puedes escucharme?',
  'Explícame qué es la música en Chile',
  'Quiero escuchar música',
  '[Música] puedes detener esto',
  'Lumia, detén la música',
  'La Lumia',
  '¡Tua!',
  'El sonido se escucha como un aplauso',
]
for (const said of validSpeech) {
  assert.equal(isNonSpeechTranscript(said), false, 'Keep real words: ' + said)
}

console.log('LUMIA VL-06 Whisper repeated noise annotations: PASS')
console.log('Pure noise ignored without censoring music-related user requests: PASS')