import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseLumiaAvatarAction} from '../src/scene/lumia-motion-r8/avatar-presence-ph04'
import {parseModelControl} from '../bridge/orbia/model-manager.mjs'
import {isSkillRegistryInquiry,skillRegistryReply,buildLumiaSkillRegistry} from '../bridge/orbia/skill-registry-skill01.mjs'
import {isTechnicalVrmQuestion,technicalVrmSystemHint,VRM_TECH_SYSTEM_HINT_VQ03} from '../bridge/orbia/vrm-tech-grounding-vq03.mjs'

const actualAsusWritten=[
  '¿Cómo puedo conseguir que un avatar VRM tenga animaciones fluidas?',
  'Si quisiera convertir una IA local en el sistema nervioso que controla un VRM, ¿qué tendría que hacer?',
]
const previousAsusSpoken=[
  'Lumi, ¿qué sabes tú acerca de los VRAM y cómo podemos hacer para que un VRM tenga animaciones fluidas?',
  'Lumi y si quisiera hacer de una IA local un sistema nervioso que controlara la animación de un VRAM.',
  'en realidad la pregunta era si quisiera hacer una ia local un sistema nervioso que controlara la animacion de un vrm que tendria que hacer',
]
for(const said of [...actualAsusWritten,...previousAsusSpoken]){
  assert.equal(parseLumiaAvatarAction(said),null,
    'Technical question must reach Qwen; NOT avatar canned response: '+said)
  assert.equal(parseModelControl(said),null,
    'Technical question must not switch local models: '+said)
  assert.equal(isSkillRegistryInquiry(said),false,
    'Original question must not be interpreted as skills/memory: '+said)
  assert.equal(isTechnicalVrmQuestion(said),true)
  const hint=technicalVrmSystemHint(said)
  assert.match(hint,/VRM se refiere a un avatar humanoide 3D/)
  assert.match(hint,/VRAM es memoria gráfica/)
  assert.match(hint,/controlador de estados/)
  assert.ok(hint.length<900)
}
// Proof of the reported regression: the OLD UI implementation appended
// a hint containing "memoria" to the user's question; SKILL-01 then treated
// the question as an unrelated request about persistent session memory.
const memoryCollision=actualAsusWritten[1]+VRM_TECH_SYSTEM_HINT_VQ03
assert.equal(isSkillRegistryInquiry(memoryCollision),true)
const wrongMemory=skillRegistryReply({
  prompt:memoryCollision,registry:buildLumiaSkillRegistry(),
})
assert.match(wrongMemory??'',/MEM-01 está pendiente/)
assert.equal(isSkillRegistryInquiry(actualAsusWritten[1]),false)
assert.equal(technicalVrmSystemHint('¿Qué recuerdos tienes de nuestras conversaciones?'),'')
// Unrelated hardware questions must remain literal VRAM questions.
for(const said of [
  '¿Qué diferencia hay entre GPU y VRAM?',
  '¿Cuánta VRAM dedicada necesita una GPU para trabajar con animaciones?',
  'Explica cómo optimizar memoria gráfica VRAM en NVIDIA para Blender',
  'Lumia, explícale a mi amigo qué es la RAM',
]){
  assert.equal(technicalVrmSystemHint(said),'',said)
}
for(const said of [
  'Lumi, ¿cuáles son tus animaciones disponibles?',
  'Lumi, ¿qué animaciones tienes disponibles?',
  'Lumi, dime tus gestos',
  'Lumi, ¿cuántas animaciones tienes?',
]){
  assert.deepEqual(parseLumiaAvatarAction(said),{kind:'list-motions'},said)
}
for(const [said,kind] of [
  ['Lumi, salúdame con la mano','motion'],
  ['Lumia, cambia a la vista de medio cuerpo','view'],
  ['Lumi, ¿cuáles son tus tres vistas?','list-views'],
  ['Lumi, ¿qué cuerpo virtual tienes?','describe'],
] as const){
  assert.equal(parseLumiaAvatarAction(said)?.kind,kind,said)
  assert.equal(technicalVrmSystemHint(said),'')
}
assert.equal(parseLumiaAvatarAction('¿Qué es un avatar VRM?'),null)
assert.equal(parseLumiaAvatarAction('¿Cómo funciona tu avatar VRM?'),null)
assert.equal(parseLumiaAvatarAction('Lumi, ejecuta animación waving')?.kind,'motion')

const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const app=read('src/App.tsx')
const bridge=read('bridge/ollama.mjs')
const launch=read('INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd')
const qaLaunch=read('INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd')
const base=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
assert.doesNotMatch(app,/withVrmTechnicalContext|vrm-tech-grounding-vq03/)
assert.match(app,/: said,\s*history\.current/)
assert.match(app,/const avatarAction = AVATAR_PH04_ENABLED && !visualImage && !captureFailure/)
assert.match(bridge,/\? technicalVrmSystemHint\(prompt\) : ''/)
assert.match(bridge,/isSkillRegistryInquiry\(prompt\)/)
assert.match(bridge,/appendConversationExchange\(conversationId, prompt, answer\)/)
assert.match(qaLaunch,/ORBIA_LUMIA_VRM_GROUNDING_VQ03=1/)
assert.doesNotMatch(launch,/ORBIA_LUMIA_VRM_GROUNDING_VQ03/)
assert.match(base,/ORBIA_LUMIA_MODEL=qwen3\.5:2b-q4_K_M/)
assert.match(launch,/INICIAR_LUMIA_ASUS_RAPIDA\.cmd/)
assert.match(base,/VITE_LUMIA_AVATAR_PH04=1/)
assert.match(base,/ORBIA_LUMIA_TTS_MODE=local/)
assert.match(base,/ORBIA_LUMIA_STT_MODE=local/)
assert.match(base,/JARVIS_ALLOW_WRITES=0/)
console.log('VQ-03.1 PASS: ASUS exact written VRM questions reach Ollama; SKILL-01 memory collision prevented; PH-04 controls, 2B and raw history preserved')
