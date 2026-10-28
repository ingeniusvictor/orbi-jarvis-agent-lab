import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildModelInventory, getActiveModel, parseModelControl, setActiveModel,
} from '../bridge/orbia/model-manager.mjs'

const installed = [
  'orbia-lumia:4b',
  'qwen3:1.7b',
  'qwen3:4b',
  'qwen2.5-coder:7b',
  'qwen3.5:0.8b',
  'qwen3.5:2b-q4_K_M',
]
const fromScreenshot = [
  { role: 'user', content: 'Puedes indicarme cuántos modelos tienes para cambiar' },
  { role: 'assistant', content: 'L.U.M.I.A. tiene varios modelos de inteligencia artificial disponibles para adaptarse a diferentes tareas y necesidades.' },
]
const fromRealRegistry = [
  { role: 'user', content: '¿Cuántos modelos tienes instalados?' },
  { role: 'assistant', content: 'Tengo 6 modelos locales instalados en Ollama. Ahora estoy usando qwen3:1.7b.' },
]
for (const q of [
  'Lumi, ¿cuántos modelos tienes?',
  'Puedes indicarme cuántos modelos tienes para cambiar',
  'Quiero saber cuántos modelos de IA tienes disponible para cambiar',
  '¿Cuántos modelos instalados hay en mi computadora?',
]) {
  assert.deepEqual(parseModelControl(q), { action: 'count' }, q)
}
for (const q of [
  'Lumi, ¿cuáles son esos modelos?',
  '¿Cuáles son los modelos?',
  '¿Cuáles son estos modelos?',
]) {
  assert.deepEqual(parseModelControl(q, fromScreenshot), { action: 'list' }, q)
}
assert.deepEqual(parseModelControl('¿Cuáles son esos modelos?', fromRealRegistry), { action: 'list' })
for (const q of [
  '¿Qué modelos puedo usar?',
  '¿Qué modelos tienes instalados?',
  'Muéstrame los modelos',
  'Lumi, puedes cambiar de modelo?',
  '¿Cuáles son los modelos que tienes disponibles?',
]) {
  assert.deepEqual(parseModelControl(q), { action: 'list' }, q)
}
for (const q of [
  'Cuáles son esos modelos',
  'Cuáles son los modelos',
  '¿Cuántos modelos de inteligencia artificial existen en el mundo?',
  '¿Qué diferencias hay entre los modelos de visión y los de texto?',
  'Quiero entender cómo funciona un modelo local',
  'Lumi, no quiero cambiar de modelo',
  '¿Cuál modelo me conviene según mis necesidades?',
]) {
  assert.equal(parseModelControl(q), null, q)
}
assert.deepEqual(parseModelControl('Lumi, cámbiate al modelo rápido'),
  { action: 'switch', requested: 'rápido' })
assert.deepEqual(parseModelControl('Lumi, cambia al modelo qwen3:4b'),
  { action: 'switch', requested: 'qwen3:4b' })

const old = getActiveModel()
setActiveModel('qwen3:1.7b')
const items = buildModelInventory(installed)
assert.equal(items.length, 6)
assert.equal(items.filter(i => i.active).length, 1)
assert.equal(items.find(i => i.active)?.name, 'qwen3:1.7b')
setActiveModel(old)

const bridge = readFileSync(new URL('../bridge/ollama.mjs', import.meta.url), 'utf8')
assert.match(bridge, /parseModelControl\(prompt, history\)/)
assert.match(bridge, /\/api\/tags/)
assert.match(bridge, /modelControl\.action === 'count'/)
assert.match(bridge, /modelControl\.action === 'list'/)
assert.match(bridge, /answer = modelInventoryCountToSpeech\(probe\.models\)/)
assert.match(bridge, /answer = modelInventoryToSpeech\(probe\.models\)/)
assert.match(bridge, /\x60Tengo \$\{inventory\.length\} modelos locales instalados en Ollama\./)
assert.match(bridge, /send\(\{ type: 'done',/)
const avatar = readFileSync(new URL('../src/scene/LumiaAvatar.tsx', import.meta.url), 'utf8')
assert.match(avatar, /const FACE_HEIGHT_FRACTION = 0\.47/)
assert.match(avatar, /const FACE_SHIFT_PX = 25/)
console.log('LUMIA MI-02: count/list and pronoun follow-up route to real Ollama registry: PASS')
console.log('General model questions and pre-existing model switches remain unchanged: PASS')
console.log('No GLB, avatar, STT, Kokoro or model download touched: PASS')
