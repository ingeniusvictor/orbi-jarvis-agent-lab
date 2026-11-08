import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {visualOptionsForModel,visualFailureCategory} from '../bridge/orbia/vision-profile-amr021.mjs'
import {classifyLumiaVisualFailure,lumiaVisualFailureReply} from '../src/lib/vision-failure-amr021'
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const bridge=read('bridge/ollama.mjs')
const app=read('src/App.tsx')
assert.deepEqual(visualOptionsForModel('qwen3.5:4b-fast'),
  {temperature:0,num_ctx:2048,num_predict:256})
assert.deepEqual(visualOptionsForModel('QWEN3.5:4B-FAST'),
  {temperature:0,num_ctx:2048,num_predict:256})
// Other installed visual brains keep the existing certified behavior.
for(const model of ['qwen3.5:2b-q4_K_M','qwen3.5:4b','qwen3.8:4b-gpu'])
  assert.deepEqual(visualOptionsForModel(model),
    {temperature:0,num_ctx:4096,num_predict:256})
assert.equal(visualFailureCategory('Ollama visual HTTP 500: CUDA out of memory'),'memory')
assert.equal(visualFailureCategory('prompt exceeds context window'),'context')
assert.equal(visualFailureCategory('this model does not support images'),'unsupported')
assert.equal(visualFailureCategory('Ollama visual HTTP 500'),'runner')
assert.equal(classifyLumiaVisualFailure(new Error('La IA local falló: Ollama visual HTTP 500: CUDA out of memory')),'memory')
assert.match(lumiaVisualFailureReply(new Error('CUDA out of memory'),false),/memoria o GPU/)
assert.match(lumiaVisualFailureReply(new Error('prompt exceeds context window'),true),/volver a analizar esa fotografía/)
assert.match(lumiaVisualFailureReply(new Error('Ollama visual HTTP 500'),false),/no significa necesariamente/)
assert.match(lumiaVisualFailureReply(new Error('not support images'),false),/no admite imágenes/)
const visual=bridge.slice(
  bridge.indexOf('  if (image) {',bridge.indexOf('export async function streamOllama')),
  bridge.indexOf('  const responseSchema =',bridge.indexOf('export async function streamOllama')))
assert.match(visual,/const visualOptions = visualOptionsForModel\(model\)/)
assert.match(visual,/options: visualOptions/)
assert.match(visual,/images: \[image\.data\]/)
assert.match(visual,/think: false/)
assert.match(visual,/stream: false/)
assert.doesNotMatch(visual,/\.\.\.history/)
assert.doesNotMatch(visual,/options: \{ temperature: 0, num_ctx: 4096/)
assert.match(app,/lumiaVisualFailureReply\(err, Boolean\(visualFollowUp\)\)/)
assert.match(app,/classifyLumiaVisualFailure\(err\)/)
assert.match(app,/visualInferenceFailed=true/)
assert.match(bridge,/if \(image && process\.env\.ORBIA_LUMIA_VISION_ENABLED !== '1'\)/)
console.log('AMR-02.1 PASS: 4B-Fast visual context honors 2048, legacy 2B image path unchanged, error types transparent, no visual echo or silent model fallback')
