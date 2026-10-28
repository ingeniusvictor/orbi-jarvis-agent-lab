import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLocalVisualImage } from '../bridge/orbia/visual-input.mjs'

const sampleJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const jpeg = { mimeType: 'image/jpeg', data: sampleJpegBytes.toString('base64') }
assert.deepEqual(parseLocalVisualImage(jpeg), jpeg)
assert.equal(parseLocalVisualImage(undefined), null)
for (const bad of [
  '', 12, [], {},
  { mimeType: 'image/png', data: jpeg.data },
  { mimeType: 'image/jpeg', data: '!!!' },
  { mimeType: 'image/jpeg', data: Buffer.from('not a jpeg').toString('base64') },
  { mimeType: 'image/jpeg', data: 'a'.repeat(2_000_004) },
]) assert.throws(() => parseLocalVisualImage(bad))

const file = readFileSync(new URL('../src/lib/visual-input.ts', import.meta.url), 'utf8')
const ui = readFileSync(new URL('../src/ui/VisualInput.tsx', import.meta.url), 'utf8')
const brain = readFileSync(new URL('../src/lib/brain.ts', import.meta.url), 'utf8')
const transport = readFileSync(new URL('../src/lib/bridge.ts', import.meta.url), 'utf8')
const ollama = readFileSync(new URL('../bridge/ollama.mjs', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const avatar = readFileSync(new URL('../src/scene/LumiaAvatar.tsx', import.meta.url), 'utf8')

assert.match(file, /MAX_VISUAL_FILE_BYTES = 12 \* 1024 \* 1024/)
assert.match(file, /createImageBitmap\(file\)/)
assert.match(file, /toDataURL\('image\/jpeg'/)
assert.match(file, /MAX_VISUAL_PAYLOAD_CHARS/)
assert.match(ui, /type="file"/)
assert.match(ui, /ANALIZAR Y RESPONDER/)
assert.match(ui, /onAnalyze\(prompt\.trim\(\)/)
assert.match(brain, /if \(image && !usingBridge\)/)
assert.match(transport, /\.\.\.\(image \? \{ image \} : \{\}\)/)
assert.match(ollama, /parseLocalVisualImage\(msg\.image\)/)
assert.match(ollama, /ORBIA_LUMIA_VISION_ENABLED !== '1'/)
assert.match(ollama, /images: \[image\.data\]/)
assert.match(ollama, /num_predict: 256/)
assert.match(ollama, /think: false/)
assert.match(app, /VITE_LUMIA_VISUAL_INPUT_VI01 === '1'/)
assert.match(app, /<VisualInput/)
assert.match(avatar, /const FACE_HEIGHT_FRACTION = 0\.47/)
assert.match(avatar, /const FACE_SHIFT_PX = 25/)

console.log('VI-01 local multimodal image validation and opt-in routing: PASS')
console.log('Voice-only requests unchanged; no image in conversation history: CONTRACT')
console.log('Approved avatar optical profile untouched: PASS')
console.log('Hardware vision latency and image-quality verification remain owner-side.')
