import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseLumiaAvatarAction} from '../src/scene/lumia-motion-r8/avatar-presence-ph04'
import {parseModelControl} from '../bridge/orbia/model-manager.mjs'
import {isSkillRegistryInquiry,skillRegistryReply,buildLumiaSkillRegistry} from '../bridge/orbia/skill-registry-skill01.mjs'
import {isTechnicalVrmQuestion,technicalVrmSystemHint,VRM_TECH_SYSTEM_HINT_VQ03,clarifyVq03AmbiguousTechnicalSpeech,isConversationalAvatarAnimationQuestion,avatarAnimationAdviceFocus,isVq03UnreliableAvatarAdvice} from '../bridge/orbia/vrm-tech-grounding-vq03.mjs'

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
// ASUS 14 Nov 2026 — three owner-spoken Whisper-local transcripts.
// Never rewrite the transcript: request clarification only when ambiguous.
const actualVoice=[
  'Lumi, explícame en dos frases que es un VRAM.',
  'Lumi, ¿cómo podrías mejorar tus animaciones para que esperan de manera más natural?',
  'Lumi, ¿cómo podrías controlar mejor tus animaciones mientras conversamos?',
]
const vrmOrVram=clarifyVq03AmbiguousTechnicalSpeech(actualVoice[0])
assert.match(vrmOrVram??'',/VRM, el formato de avatares 3D/)
assert.match(vrmOrVram??'',/VRAM, la memoria gráfica/)
assert.equal(parseLumiaAvatarAction(actualVoice[0]),null)
assert.equal(parseModelControl(actualVoice[0]),null)
const sttNatural=clarifyVq03AmbiguousTechnicalSpeech(actualVoice[1])
assert.match(sttNatural??'',/animaciones se vean y se muevan/)
assert.equal(parseLumiaAvatarAction(actualVoice[1]),null)
assert.equal(parseModelControl(actualVoice[1]),null)
assert.equal(clarifyVq03AmbiguousTechnicalSpeech(actualVoice[2]),null)
assert.equal(isConversationalAvatarAnimationQuestion(actualVoice[2]),true)
assert.match(technicalVrmSystemHint(actualVoice[2]),/No afirmes que existen comandos de usuario pause\/resume/)
assert.match(technicalVrmSystemHint(actualVoice[2]),/estados de conversación/)
assert.equal(parseLumiaAvatarAction(actualVoice[2]),null)
assert.equal(parseModelControl(actualVoice[2]),null)
// Correctly transcribed VRM definition should not need disambiguation.
assert.equal(clarifyVq03AmbiguousTechnicalSpeech('Lumi, ¿qué es un avatar VRM?'),null)
assert.equal(clarifyVq03AmbiguousTechnicalSpeech('Lumi, explícame qué es un VRM.'),null)
// Genuine graphics-memory questions must never be hijacked or "corrected".
for(const said of [
  '¿Cuánta VRAM dedicada necesita una GPU para trabajar con animaciones?',
  'Explícame qué es VRAM en una GPU de 12 GB.',
  '¿Qué es un VRAM de la tarjeta gráfica?',
  '¿Qué es la VRAM de mi NVIDIA?',
]) {
  assert.equal(clarifyVq03AmbiguousTechnicalSpeech(said),null,said)
  assert.equal(technicalVrmSystemHint(said),'',said)
}
// Ordinary questions about motion, not malformed STT, must pass to Qwen.
for(const said of [
  '¿Cómo mejorar las animaciones de un personaje?',
  '¿Cómo funcionan los tiempos de espera de una animación?',
  'Lumi, ¿qué animaciones tienes?',
])assert.equal(clarifyVq03AmbiguousTechnicalSpeech(said),null,said)

// ASUS 14 Nov 2026 01:55-01:57 — VQ-03.5 newly observed voice regressions.
const newAsusVoice=[
  'Lumi, explícame en dos frases que es un avatar BRM.',
  'Lumi como podrías mejorar tus animaciones para que se vea más natural.',
  'Lumi como podrías controlar mejor tus animaciones mientras conversamos.',
]
assert.equal(isSkillRegistryInquiry(newAsusVoice[0]),false)
assert.equal(parseLumiaAvatarAction(newAsusVoice[0]),null)
assert.equal(parseModelControl(newAsusVoice[0]),null)
assert.match(clarifyVq03AmbiguousTechnicalSpeech(newAsusVoice[0])??'',/Whisper entendió BRM/)
assert.match(clarifyVq03AmbiguousTechnicalSpeech(newAsusVoice[0])??'',/VRM, el formato/)
assert.equal(clarifyVq03AmbiguousTechnicalSpeech('¿Qué es BRM en gestión empresarial?'),null)
assert.equal(clarifyVq03AmbiguousTechnicalSpeech('Define una base de recursos meteorológicos BRM'),null)
assert.equal(clarifyVq03AmbiguousTechnicalSpeech('¿Qué es un avatar VRM?'),null)
assert.equal(avatarAnimationAdviceFocus(newAsusVoice[1]),'motion-naturalness')
assert.equal(avatarAnimationAdviceFocus(newAsusVoice[2]),'conversation-control')
assert.equal(clarifyVq03AmbiguousTechnicalSpeech(newAsusVoice[1]),null)
assert.equal(clarifyVq03AmbiguousTechnicalSpeech(newAsusVoice[2]),null)
assert.match(technicalVrmSystemHint(newAsusVoice[1]),/pregunta ACTUAL sobre NATURALIDAD/)
assert.match(technicalVrmSystemHint(newAsusVoice[2]),/pregunta ACTUAL sobre CONTROL/)
for(const phrase of newAsusVoice.slice(1)){
  assert.equal(parseLumiaAvatarAction(phrase),null)
  assert.equal(parseModelControl(phrase),null)
}
const prevReply='Para mejorar las animaciones, puedo ajustar los tiempos de transición entre movimientos, suavizar la interpolación de los huesos y sincronizar mejor los cambios de visor con el flujo del diálogo. ¿Te gustaría probar una simulación de esos ajustes ahora mismo?'
const repeatReply='Para mejorar la naturalidad, puedo ajustar los tiempos de transición entre movimientos y sincronizar mejor los cambios de visor con el flujo del diálogo. ¿Te gustaría probar una simulación de esos ajustes ahora mismo?'
const history=[{role:'user',content:newAsusVoice[1]},{role:'assistant',content:prevReply}]
assert.equal(isVq03UnreliableAvatarAdvice({prompt:newAsusVoice[1],answer:prevReply,history:[]}),true)
assert.equal(isVq03UnreliableAvatarAdvice({prompt:newAsusVoice[2],answer:repeatReply,history}),true)
assert.equal(isVq03UnreliableAvatarAdvice({prompt:newAsusVoice[2],answer:'Bastaría ajustar los tiempos de transición entre movimientos.',history}),true)
assert.equal(isVq03UnreliableAvatarAdvice({prompt:newAsusVoice[2],answer:'Para controlar el avatar durante la conversación, un controlador de estados escucha, pensamiento, habla y reposo seleccionaría gestos Motion R8 en función de eventos y sincronizaría visemas con Kokoro. Esto sería una mejora por implementar.',history}),false)
assert.equal(isVq03UnreliableAvatarAdvice({prompt:'¿Cuánta VRAM necesita mi GPU?',answer:prevReply,history}),false)
assert.equal(isVq03UnreliableAvatarAdvice({prompt:'Lumi, salúdame con la mano',answer:prevReply,history}),false)
// Command-mode vocabulary can bias Whisper toward VRM while leaving VRAM intact.
const vocab=readFileSync(new URL('../bridge/orbia/speech-vocabulary.mjs',import.meta.url),'utf8')
assert.match(vocab,/'VRM'/)
assert.match(vocab,/'VRAM'/)

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
assert.match(bridge,/clarifyVq03AmbiguousTechnicalSpeech\(prompt\)/)
assert.match(bridge,/isVq03UnreliableAvatarAdvice\(\{prompt,answer,history\}\)/)
assert.match(bridge,/!unreliableVq035\(retryText\)/)
assert.match(bridge,/translationCapability \|\| vq034Clarify/)
assert.match(bridge,/appendConversationExchange\(conversationId, prompt, answer\)/)
assert.match(qaLaunch,/ORBIA_LUMIA_VRM_GROUNDING_VQ03=1/)
assert.doesNotMatch(launch,/ORBIA_LUMIA_VRM_GROUNDING_VQ03/)
assert.match(base,/ORBIA_LUMIA_MODEL=qwen3\.5:2b-q4_K_M/)
assert.match(launch,/INICIAR_LUMIA_ASUS_RAPIDA\.cmd/)
assert.match(base,/VITE_LUMIA_AVATAR_PH04=1/)
assert.match(base,/ORBIA_LUMIA_TTS_MODE=local/)
assert.match(base,/ORBIA_LUMIA_STT_MODE=local/)
assert.match(base,/JARVIS_ALLOW_WRITES=0/)
console.log('VQ-03.5 PASS: avatar BRM STT asks clarification; naturalness vs conversation control isolated; unsupported simulation offers and repeated replies guarded; VRM/VRAM, PH-04, SKILL-01 unchanged')
