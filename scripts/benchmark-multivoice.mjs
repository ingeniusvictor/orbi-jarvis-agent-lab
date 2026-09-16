/**
 * Explicit VF-02 benchmark for a real mono PCM16 WAV file.
 *
 * Usage:
 *   npm run voice:benchmark:multivoice -- "C:\path\sample.wav"
 *
 * Nothing is retained or uploaded. Results are printed to the terminal only.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { transcribeMultivoiceLocalWav } from '../bridge/orbia/multivoice-stt.mjs'
import { probeSpeakerDiarization } from '../bridge/orbia/speaker-diarization-probe.mjs'

const file = process.argv[2]
if (!file) {
  console.error('Usage: npm run voice:benchmark:multivoice -- <mono-16k-pcm16.wav>')
  process.exit(2)
}

const readiness = probeSpeakerDiarization()
if (!readiness.available) {
  console.error('Multivoice runtime is not ready.')
  console.error('Run: npm run voice:setup:diarization')
  console.error('Then: npm run voice:doctor')
  process.exit(3)
}

const path = resolve(file)
const audio = await readFile(path)
const started = performance.now()
const result = await transcribeMultivoiceLocalWav(audio)
const elapsed = performance.now() - started

console.log('O.R.B.I.A. Multivoice Benchmark')
console.log('-------------------------------')
console.log(`file: ${path}`)
console.log(`speaker count: ${result.speakerCount}`)
console.log(`segments: ${result.segments.length}`)
console.log(`speaker turns: ${result.turns.length}`)
console.log(`total latency: ${elapsed.toFixed(0)} ms`)
console.log('')

for (const turn of result.turns) {
  console.log(
    `[${turn.start.toFixed(2)}s -> ${turn.end.toFixed(2)}s] ${turn.speaker}: ${turn.text || '(sin texto)'}`,
  )
}
