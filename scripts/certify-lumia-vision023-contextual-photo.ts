import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  EphemeralVisualContext,VISION_CONTEXT_TTL_MS,
  classifyVisualFollowUp,visualModeInstruction,followupVisionPrompt,visualSpatialFocus,
} from '../src/lib/vision-context-vi023'
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const fakeA={mimeType:'image/jpeg' as const,data:'TEST-IMAGE-A-ONLY'}
const fakeB={mimeType:'image/jpeg' as const,data:'TEST-IMAGE-B-ONLY'}
const valid=[
  'Lumi, ¿qué puedes decirme del objeto que aparece detrás?',
  'Lumi, ¿de qué color es la camiseta?',
  'Lumi, ¿cuántas personas aparecen en la imagen?',
  'Lumi, ¿qué hay a la izquierda?',
  'Y el fondo, ¿qué tiene?',
  'Lumia, ¿qué ves en esa foto?',
  'Lumi, ¿cómo es la ropa que lleva?',
  'Lumi, ¿qué más puedes observar?',
  '¿Qué aparece en el fotograma?',
  '¿Y qué más?',
  'que hay destras y de que color es?',
  '¿Qué hay atrás de esa persona?',
]
for(const sentence of valid){
  assert.ok(classifyVisualFollowUp(sentence),'Must detect visual follow-up: '+sentence)
}
const denied=[
  'Lumi, dime la hora.',
  'Lumi, ¿cómo está el clima en Santiago?',
  'Lumi, ¿qué opinas de la música?',
  'Lumi, programa un juego de Tetris.',
  'Lumi, genera un video de la foto.',
  'Lumi, guarda esa fotografía en una carpeta.',
  'Lumi, ¿cuánto cuesta un teléfono?',
  'Lumi, abre mi navegador.',
  'Lumi, cambia a la vista de cuerpo completo.',
  'Lumi, ¿cómo estás?',
  'Lumi, descarta la foto.',
  'Lumi, no mires la foto.',
  'Lumi, ¿puedes crear una imagen nueva?',
]
for(const sentence of denied)assert.equal(classifyVisualFollowUp(sentence),null,
  'No old photo in unrelated/action request: '+sentence)
assert.match(visualModeInstruction('breve'),/una o dos frases/)
assert.match(visualModeInstruction('breve'),/40 palabras/)
assert.match(visualModeInstruction('detallada'),/detalles útiles/)
assert.match(followupVisionPrompt('¿Qué hay detrás?','breve'),/LA MISMA fotografía adjunta nuevamente/)
assert.match(followupVisionPrompt('¿Qué hay detrás?','breve'),/no supongas que la cámara sigue activa/)
assert.match(followupVisionPrompt('¿Qué hay detrás?','breve'),/40 palabras/)
assert.match(visualSpatialFocus('que hay destras y de que color es?'),/IDENTIFICA PRIMERO/)
assert.match(visualSpatialFocus('que hay destras y de que color es?'),/Después describe el color/)
assert.match(visualSpatialFocus('que hay destras y de que color es?'),/pide una aclaración breve/)
assert.match(visualSpatialFocus('¿Qué hay en el fondo?'),/no afirmes que no hay más objetos/)
assert.equal(visualSpatialFocus('¿Qué hora es?'),'')
assert.match(followupVisionPrompt('¿Qué hay detrás y de qué color es?','breve'),/imagen ACTUAL de nuevo/)
assert.match(followupVisionPrompt('¿Qué hay detrás y de qué color es?','breve'),/IDENTIFICA PRIMERO/)
assert.match(visualModeInstruction('breve'),/evita introducciones/)

const session=new EphemeralVisualContext()
assert.equal(session.hasFrame(0),false)
assert.equal(session.getForFollowUp(valid[0],100),null)
const token=session.begin(fakeA,1000)
assert.equal(session.hasFrame(1001),true)
assert.equal(session.hasAnalyzedFrame(1001),false)
assert.equal(session.getForFollowUp(valid[0],1001),null)
assert.equal(session.confirmAnalyzed(token,1002),true)
assert.equal(session.hasAnalyzedFrame(1003),true)
assert.strictEqual(session.getForFollowUp(valid[0],1003)?.image,fakeA)
assert.strictEqual(session.getAuthorizedFrame(1003)?.image,fakeA)
assert.equal(session.getForFollowUp('Lumi, ¿qué hora es?',1003),null)
assert.equal(session.hasAnalyzedFrame(1000+VISION_CONTEXT_TTL_MS-1),true)
assert.equal(session.hasAnalyzedFrame(1000+VISION_CONTEXT_TTL_MS),false)
assert.equal(session.getForFollowUp(valid[0],1000+VISION_CONTEXT_TTL_MS+1),null)
assert.equal(session.hasFrame(1000+VISION_CONTEXT_TTL_MS+1),false)
assert.equal(VISION_CONTEXT_TTL_MS,300000)

const a=session.begin(fakeA,600000)
const b=session.begin(fakeB,600010)
assert.equal(session.confirmAnalyzed(a,600011),false)
assert.equal(session.confirmAnalyzed(b,600012),true)
assert.strictEqual(session.getForFollowUp(valid[0],600013)?.image,fakeB)
session.clear()
assert.equal(session.hasAnalyzedFrame(600014),false)
assert.equal(session.getAuthorizedFrame(600014),null)
assert.equal(session.confirmAnalyzed(b,600014),false)

const app=read('src/App.tsx')
const ui=read('src/ui/LumiaCameraViewfinder.tsx')
const bridge=read('bridge/ollama.mjs')
const composer=read('src/ui/LumiaComposer.tsx')
const registry=read('src/lib/vision-context-vi023.ts')
const workflow=read('.github/workflows/lumia-vision023-visual-context.yml')
assert.match(app,/const visualSession = useRef\(new EphemeralVisualContext\(\)\)/)
assert.match(app,/setVisionContextReady\(true\)/)
assert.match(app,/confirmAnalyzed\(visualGeneration\)/)
assert.match(app,/visualSession\.current\.getForFollowUp\(said\)/)
assert.match(app,/visualSession\.current\.getAuthorizedFrame\(\)/)
assert.match(app,/followupVisionPrompt\(visualQuestion,visionReplyMode\)/)
assert.match(app,/visualModeInstruction\(visionReplyMode\)/)
assert.match(app,/let visualImage=image \?\? visualFollowUp\?\.image/)
assert.match(app,/if\(visualImage\) activeVisualReply\.current=turnId/)
assert.match(app,/visualSession\.current\.clear\(\)/)
assert.match(app,/setCameraStill\(null\)/)
assert.match(app,/window\.setTimeout\(\(\)=>\{[\s\S]+?setCameraStill\(null\)[\s\S]+?\},VISION_CONTEXT_TTL_MS\)/)
assert.match(app,/const closeCameraViewfinder = \(\) => \{/)
assert.match(app,/interrupt\(\)/)
assert.match(app,/onAskAboutStill=\{submitVisualFollowUp\}/)
assert.match(app,/void respond\(text,undefined,false,false,true\)/)
assert.match(app,/captureLumiaAuthorizedStill\(stale,undefined,route.resolution\)/)
assert.match(app,/const cameraIntent = CAMERA_VISION_VI02_ENABLED && !image && !visualFollowUp/)
assert.match(app,/visualSession\.current\.confirmAnalyzed\(visualGeneration\)/)
assert.match(ui,/visualReplyMode==='breve'/)
assert.match(ui,/visualReplyMode==='detallada'/)
assert.match(ui,/onVisualReplyModeChange\('breve'\)/)
assert.match(ui,/onVisualReplyModeChange\('detallada'\)/)
assert.match(ui,/onAskAboutStill\(question\)/)
assert.match(ui,/visualContextReady/)
assert.match(ui,/Foto temporal · 5 minutos · se descarta al cerrar/)
assert.match(ui,/aria-label="Pregunta sobre la misma fotografía"/)
assert.match(ui,/data:image\/jpeg;base64,/)
assert.match(bridge,/if \(image\) \{/)
assert.match(bridge,/images: \[image\.data\]/)
assert.match(bridge,/No image data in logs, transcript or process-local history/)
assert.match(composer,/onCaptureCamera\?\.\(\)/)
assert.doesNotMatch(registry.replace(/\/\*[\s\S]*?\*\//g,''),/localStorage|sessionStorage|indexedDB|fetch\(|getUserMedia|writeFile/)
assert.match(workflow,/scripts\/certify-lumia-vision023-contextual-photo\.ts/)
assert.match(workflow,/scripts\/certify-lumia-vision022-camera-source\.ts/)
assert.match(workflow,/scripts\/certify-lumia-vision02-camera\.ts/)
console.log('VISION-02.3 PASS: contextual photo follow-ups without new webcam, 5-minute ephemeral TTL, close/replacement cancellation, short visual voice and normal text isolation')
