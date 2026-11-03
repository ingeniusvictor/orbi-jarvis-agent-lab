import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SKILL_REGISTRY_VERSION,
  SKILL_STATES,
  buildLumiaSkillRegistry,
  isSkillRegistryInquiry,
  skillRegistryReply,
} from '../bridge/orbia/skill-registry-skill01.mjs'

const env = {
  ORBIA_BRAIN_PROVIDER:'ollama',
  ORBIA_LUMIA_STT_MODE:'local',
  ORBIA_LUMIA_TTS_MODE:'local',
  ORBIA_LUMIA_TRANSLATE_ENABLED:'1',
  ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED:'1',
  ORBIA_LUMIA_VISION_ENABLED:'1',
  JARVIS_ALLOW_WRITES:'0',
}
const withAssets = () => ({
  stt:{localAvailable:true},
  tts:{localAvailable:true},
})
const missingAssets = () => ({
  stt:{localAvailable:false},
  tts:{localAvailable:false},
})
const build = (options={}) =>
  buildLumiaSkillRegistry({env,voiceProbe:withAssets,...options})
const registry=build()
assert.equal(registry.version,SKILL_REGISTRY_VERSION)
const items=new Map(registry.capabilities.map(item=>[item.id,item]))
assert.equal(items.size,registry.capabilities.length,'Unique skill identifiers')
for (const item of registry.capabilities) {
  assert.ok(SKILL_STATES.includes(item.state),'Known state for '+item.id)
  assert.ok(item.name && item.version && item.description && item.limitation && item.source)
  assert.equal(Object.isFrozen(item),true)
}
assert.equal(Object.isFrozen(registry.capabilities),true)
assert.equal(items.get('conversation').state,'configured')
assert.equal(items.get('session-context').state,'configured')
assert.equal(items.get('persistent-memory').state,'pending')
assert.match(items.get('persistent-memory').limitation,/no se guardan recuerdos persistentes/i)
assert.equal(items.get('stt-local').state,'configured')
assert.equal(items.get('tts-local').state,'configured')
assert.equal(items.get('translation-text').state,'configured')
assert.equal(items.get('translation-audio').state,'configured')
assert.equal(items.get('vision-photo').state,'experimental')
assert.equal(items.get('live-weather').state,'unavailable')
assert.equal(items.get('desktop-control').state,'unavailable')
assert.equal(items.get('live-interpretation').state,'pending')

const turnedOff = build({
  env:{
    ...env,
    ORBIA_LUMIA_TRANSLATE_ENABLED:'0',
    ORBIA_LUMIA_TRANSLATE_AUDIO_ENABLED:'0',
    ORBIA_LUMIA_VISION_ENABLED:'0',
  },
})
const off = new Map(turnedOff.capabilities.map(item=>[item.id,item]))
assert.equal(off.get('translation-text').state,'disabled')
assert.equal(off.get('translation-audio').state,'disabled')
assert.equal(off.get('vision-photo').state,'disabled')
assert.equal(off.get('persistent-memory').state,'pending')

const noModel = build({env:{...env,ORBIA_BRAIN_PROVIDER:'claude'},voiceProbe:withAssets})
const notLocal = new Map(noModel.capabilities.map(item=>[item.id,item]))
assert.equal(notLocal.get('conversation').state,'disabled')
assert.equal(notLocal.get('translation-text').state,'disabled')
assert.equal(notLocal.get('translation-audio').state,'disabled')
const noAssets = build({voiceProbe:missingAssets})
const missing = new Map(noAssets.capabilities.map(item=>[item.id,item]))
assert.equal(missing.get('stt-local').state,'unavailable')
assert.equal(missing.get('tts-local').state,'unavailable')
assert.equal(missing.get('translation-audio').state,'unavailable')
assert.equal(missing.get('translation-text').state,'configured')
assert.equal(missing.get('persistent-memory').state,'pending')
const sttOff = build({env:{...env,ORBIA_LUMIA_STT_MODE:'auto'}})
assert.equal(sttOff.capabilities.find(x=>x.id==='stt-local').state,'disabled')

assert.equal(isSkillRegistryInquiry('Lumi, ¿qué habilidades tienes actualmente?'),true)
assert.equal(isSkillRegistryInquiry('Lumi, ¿puedes recordar lo que hablamos ayer?'),true)
assert.equal(isSkillRegistryInquiry('¿Qué funciones tienes deshabilitadas?'),true)
assert.equal(isSkillRegistryInquiry('¿Qué habilidades nuevas has recibido?'),true)
assert.equal(isSkillRegistryInquiry('Lumi, coméntame sobre tus capacidades para traducir audios y texto.'),false,'Focused translation must use detailed RC-04 guidance')
for (const request of [
  'Lumi como estas','Traduce esto al inglés','Lumi, abre el navegador',
  'Lumi, memoriza mi contraseña','Borra todos mis archivos',
  'Me gustaría hablar sobre memorias RAM',
]) assert.equal(isSkillRegistryInquiry(request),false,'Not a capability inquiry: '+request)

const active = skillRegistryReply({prompt:'Lumi, ¿qué habilidades tienes?',registry})
assert.match(active,/traducción de texto/i)
assert.match(active,/traducción de archivos de voz/i)
assert.match(active,/experimental/i)
assert.match(active,/memoria persistente sigue pendiente/i)
const inactive = skillRegistryReply({prompt:'Lumi, ¿qué funciones tienes deshabilitadas o pendientes?',registry:turnedOff})
assert.match(inactive,/Memoria persistente/i)
assert.match(inactive,/Control general de computadora/i)
const memory = skillRegistryReply({prompt:'Lumi, ¿puedes recordar lo que hablamos ayer?',registry})
assert.match(memory,/todavía no tengo memoria persistente/i)
assert.match(memory,/MEM-01 está pendiente/i)
const version = skillRegistryReply({prompt:'Lumi, ¿qué habilidades nuevas has recibido?',registry})
assert.match(version,/no tengo un historial automático de cambios/i)
const noTranslation = skillRegistryReply({prompt:'¿Qué habilidades tienes?',registry:turnedOff})
assert.doesNotMatch(noTranslation,/Traducción de archivos de voz/i)

// Informational replies only: no authorized tool call, memory write or
// weather/PC access. Verify the full adapter emits exactly one response.
const brain=readFileSync(new URL('../bridge/ollama.mjs',import.meta.url),'utf8')
const launcher=readFileSync(new URL('../INICIAR_LUMIA_ASUS_RAPIDA.cmd',import.meta.url),'utf8')
assert.match(brain,/ORBIA_LUMIA_SKILL_REGISTRY === '1'/)
assert.match(brain,/buildLumiaSkillRegistry\(\)/)
assert.match(launcher,/ORBIA_LUMIA_SKILL_REGISTRY=1/)
assert.match(brain,/rc04Pilot && !skillPilot \? RC04_TRANSLATION_FACTS : ''/)
const original=process.env.ORBIA_LUMIA_SKILL_REGISTRY
const originalProvider=process.env.ORBIA_BRAIN_PROVIDER
process.env.ORBIA_LUMIA_SKILL_REGISTRY='1'
process.env.ORBIA_BRAIN_PROVIDER='ollama'
const fetchOriginal=globalThis.fetch
let networkCalls=0
globalThis.fetch=async()=>{ networkCalls++; throw Error('No network expected from SKILL-01') }
try {
  const { streamOllama } = await import('../bridge/ollama.mjs')
  const spoken=[]
  const result=await streamOllama({
    prompt:'Lumi, ¿puedes recordar lo que hablamos ayer?',
    history:[],systemPrompt:'LUMIA test.',knowledgeContext:null,
    toolContext:'',image:null,signal:new AbortController().signal,
    onText:(text)=>spoken.push(text),
  })
  assert.match(result,/memoria persistente/i)
  assert.deepEqual(spoken,[result])
  assert.equal(networkCalls,0)
} finally {
  globalThis.fetch=fetchOriginal
  if (original===undefined) delete process.env.ORBIA_LUMIA_SKILL_REGISTRY
  else process.env.ORBIA_LUMIA_SKILL_REGISTRY=original
  if (originalProvider===undefined) delete process.env.ORBIA_BRAIN_PROVIDER
  else process.env.ORBIA_BRAIN_PROVIDER=originalProvider
}
console.log('LUMIA SKILL-01 registry: dynamic statuses, missing assets, memory honesty, secure adapter PASS')
