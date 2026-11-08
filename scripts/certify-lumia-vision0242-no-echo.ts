import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  followupVisionPrompt,visualReliabilityInstruction,visualModeInstruction,
  classifyVisualFollowUp,EphemeralVisualContext,
} from '../src/lib/vision-context-vi023'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const backend=read('bridge/ollama.mjs')
const app=read('src/App.tsx')
const visual=backend.slice(backend.indexOf('  if (image) {',backend.indexOf('export async function streamOllama')),backend.indexOf('  const responseSchema =',backend.indexOf('export async function streamOllama')))
assert.ok(visual.includes('images: [image.data]'),'Still uses JPEG exactly once')
assert.doesNotMatch(visual,/\.\.\.history/,'No previous conversation transcript inside visual payload')
assert.match(backend,/const messages = \[[\s\S]*?\.\.\.history/,'Ordinary conversation continues using prior history')
assert.match(app,/followupVisionPrompt\(visualQuestion,visionReplyMode\)/)
assert.match(app,/visualReliabilityInstruction\(cameraIntent\?\.question \?\? said\)/)
const count=followupVisionPrompt('Lumi, ¿cuántas personas están de pie y cuántas agachadas?','breve')
assert.match(count,/su suma coincide con el total/)
assert.match(count,/NO fuerces una cifra inventada/)
assert.match(count,/no repitas ni resumas la descripción anterior/)
const center=followupVisionPrompt('¿De qué color es la camisa del hombre del centro?','breve')
assert.match(center,/aclaración corta/)
assert.match(center,/no repitas ni resumas/)
assert.match(center,/no puedes distinguir algo por nitidez o tamaño/)
assert.match(visualModeInstruction('breve'),/40 palabras/)
assert.match(visualModeInstruction('breve'),/privacidad/)
assert.match(visualReliabilityInstruction('¿Qué hay detrás?'),/JPEG adjunto/)
assert.equal(classifyVisualFollowUp('Lumi, dime la hora.'),null)
const memory=new EphemeralVisualContext()
const jpeg={mimeType:'image/jpeg' as const,data:'SIMULATED-JPEG'}
const token=memory.begin(jpeg,1_000)
assert.equal(memory.confirmAnalyzed(token,1_001),true)
assert.strictEqual(memory.getForFollowUp('¿Cuántas personas hay?',1_002)?.image,jpeg)
memory.clear()
assert.equal(memory.getAuthorizedFrame(1_003),null)
console.log('VISION-02.4.2 PASS: no visual transcript echo, same JPEG, grounded short answers, ordinary chat history and privacy TTL retained')
