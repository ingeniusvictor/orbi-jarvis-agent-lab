import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseLumiaAvatarAction} from '../src/scene/lumia-motion-r8/avatar-presence-ph04'
import {parseModelControl} from '../bridge/orbia/model-manager.mjs'
import {
  withVrmTechnicalContext,isTechnicalVrmQuestion,VRM_TECH_HINT_VQ03,
} from '../src/lib/vrm-tech-grounding-vq03'

const previousAsusTurns=[
  'Lumi, ¿qué sabes tú acerca de los VRAM y cómo podemos hacer para que un VRM tenga animaciones fluidas?',
  'Lumi y si quisiera hacer de una IA local un sistema nervioso que controlara la animación de un VRAM.',
  'en realidad la pregunta era si quisiera hacer una ia local un sistema nervioso que controlara la animacion de un vrm que tendria que hacer',
]
for(const said of previousAsusTurns){
  assert.equal(parseLumiaAvatarAction(said),null,
    'Technical VRM question must reach Qwen, not 17-item canned list: '+said)
  assert.equal(parseModelControl(said),null,
    'Technical VRM question must NOT switch Ollama models')
  assert.equal(isTechnicalVrmQuestion(said),true)
  const answerPrompt=withVrmTechnicalContext(said)
  assert.ok(answerPrompt.startsWith(said+'\n\n['))
  assert.match(answerPrompt,/VRM es un avatar humanoide 3D/)
  assert.match(answerPrompt,/VRAM es memoria de la GPU/)
  assert.match(answerPrompt,/controlador validado selecciona\/mezcla clips/)
  assert.ok(answerPrompt.length<said.length+900,'No unbounded prompt or TTS delay')
}

// Questions about one's own motion catalog must remain instant/local.
for(const said of [
  'Lumi, ¿cuáles son tus animaciones disponibles?',
  'Lumi, ¿qué animaciones tienes disponibles?',
  'Lumi, dime tus gestos',
  'Lumi, ¿cuántas animaciones tienes?',
]){
  assert.deepEqual(parseLumiaAvatarAction(said),{kind:'list-motions'},said)
  assert.equal(withVrmTechnicalContext(said),said)
}
// Commands and view controls remain local and unchanged.
for(const [said,kind] of [
  ['Lumi, salúdame con la mano','motion'],
  ['Lumia, cambia a la vista de medio cuerpo','view'],
  ['Lumi, ¿cuáles son tus tres vistas?','list-views'],
] as const){
  assert.equal(parseLumiaAvatarAction(said)?.kind,kind,said)
  assert.equal(withVrmTechnicalContext(said),said)
}

// Explicit VRAM hardware questions must NOT be rewritten into avatar ones.
for(const said of [
  '¿Qué diferencia hay entre GPU y VRAM?',
  '¿Cuánta VRAM dedicada requiere una tarjeta gráfica para animaciones?',
  'Explica cómo optimizar memoria gráfica VRAM en NVIDIA para Blender',
  'Lumia, explícale a mi amigo qué es la RAM',
]){
  assert.equal(withVrmTechnicalContext(said),said)
}
assert.equal(isTechnicalVrmQuestion('Lumia, cambia a vista de medio cuerpo'),false)
assert.equal(isTechnicalVrmQuestion('Lumia, ejecuta animación waving'),false)
assert.ok(!VRM_TECH_HINT_VQ03.includes('http'))
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const launch=readFileSync(new URL('../INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd',import.meta.url),'utf8')
const base=readFileSync(new URL('../INICIAR_LUMIA_ASUS_RAPIDA.cmd',import.meta.url),'utf8')
assert.match(app,/withVrmTechnicalContext\(said\),\s*history\.current/)
assert.match(app,/const avatarAction = AVATAR_PH04_ENABLED && !visualImage && !captureFailure/)
assert.match(app,/parseLumiaAvatarAction\(said\)/)
assert.match(base,/ORBIA_LUMIA_MODEL=qwen3\.5:2b-q4_K_M/)
assert.match(launch,/INICIAR_LUMIA_ASUS_RAPIDA\.cmd/)
assert.match(base,/VITE_LUMIA_AVATAR_PH04=1/)
assert.match(base,/VITE_LUMIA_VISION_CAMERA_VI02=1/)
assert.match(base,/ORBIA_LUMIA_TTS_MODE=local/)
assert.match(base,/ORBIA_LUMIA_STT_MODE=local/)
assert.match(base,/JARVIS_ALLOW_WRITES=0/)
console.log('VQ-03 PASS: original ASUS VRM questions routed to generative 2B with scoped VRM≠VRAM clarification; PH04 controls preserved')
