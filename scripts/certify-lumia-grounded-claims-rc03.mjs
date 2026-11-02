import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rc03GroundedReply, RC03_VOICE_GROUNDING_INSTRUCTION } from '../bridge/orbia/grounded-claims-rc03.mjs'

const weatherHistory = [
  {role:'user',content:'Lumi, tienes información del clima.'},
  {role:'assistant',content:'No tengo acceso a información actual del clima. ¿Dónde estás y qué día es hoy?'},
]
const madeUpWeatherHistory = [
  {role:'user',content:'Estoy en Rancagua, Chile y hoy es primero de noviembre de 2026.'},
  {role:'assistant',content:'En Rancagua probablemente habrá nevadas ligeras.'},
]
const reply=(prompt,history=[])=>rc03GroundedReply({prompt,history})

assert.match(reply('Lumi, ¿cómo estará el clima mañana?'),/no tengo una fuente meteorológica actualizada/i)
assert.match(reply('Lumi, tienes información del clima.'),/no puedo confirmar un pronóstico fiable/i)
assert.match(reply('Estoy en Rancagua, Chile y hoy es primero de noviembre del 2026.', weatherHistory),/no puedo confirmar un pronóstico fiable/i)
assert.match(reply('Me gustaría saber cómo hiciste esa predicción del clima, si no tienes acceso a ninguna fuente externa.',madeUpWeatherHistory),/Fue una suposición del modelo/i)
assert.match(reply('¿De dónde sacaste ese pronóstico sin fuentes?',madeUpWeatherHistory),/no debí presentarla/i)
assert.match(reply('Lumi, ¿tienes capacidad para tomar el control de mi computadora si te lo pidiera?'),/no tengo habilitado el control general/i)
assert.match(reply('¿Qué capacidades tienes actualmente?'),/diagnóstico y controles específicos/i)

for(const question of [
  'Hola Lumi, ¿cómo estás?',
  'Cómo se forman las nubes y la lluvia',
  '¿Qué es el clima y cuál es la diferencia con el tiempo?',
  'Explícame cómo hacer una predicción meteorológica con Python',
  'Quiero preparar una arepa venezolana',
  '¿Cómo puedo controlar mi computadora con Python?',
  'Estudio el clima laboral en las empresas',
]) assert.equal(reply(question),null,'Preserve normal Qwen response: '+question)

assert.equal(reply('Estoy en Rancagua, Chile y hoy es primero de noviembre de 2026.'),null,'A location/date unrelated to weather is not a forecast request')
assert.match(RC03_VOICE_GROUNDING_INSTRUCTION,/No inventes pronósticos/i)

const brain=readFileSync(new URL('../bridge/ollama.mjs',import.meta.url),'utf8')
const launcher=readFileSync(new URL('../INICIAR_LUMIA_ASUS_RAPIDA.cmd',import.meta.url),'utf8')
assert.match(launcher,/ORBIA_LUMIA_RC03_GROUNDING=1/)
assert.match(brain,/process\.env\.ORBIA_LUMIA_RC03_GROUNDING === '1'/)
assert.match(brain,/const grounded = rc03Pilot && !image \? rc03GroundedReply\(\{ prompt, history \}\) : null/)
assert.match(brain,/if \(grounded\) \{[\s\S]*?onText\(grounded\)[\s\S]*?return grounded/)
console.log('LUMIA RC-03: offline weather, follow-up correction, capabilities and normal conversation PASS')
