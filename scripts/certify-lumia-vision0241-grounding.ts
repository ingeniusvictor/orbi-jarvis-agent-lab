import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  visualReliabilityInstruction,followupVisionPrompt,
  visualModeInstruction,classifyVisualFollowUp,EphemeralVisualContext,
} from '../src/lib/vision-context-vi023'

const count=visualReliabilityInstruction('Lumi, ¿cuántas personas están de pie y cuántas agachadas?')
assert.match(count,/una sola vez/)
assert.match(count,/su suma coincide con el total/)
assert.match(count,/NO fuerces una cifra inventada/)
assert.match(count,/postura es incierta/)
const spatial=visualReliabilityInstruction('¿De qué color es la camisa del hombre en el centro?')
assert.match(spatial,/varias personas/)
assert.match(spatial,/aclaración corta/)
assert.match(spatial,/colores, logos y objetos/)
const background=visualReliabilityInstruction('¿Qué puedes observar en el cielo y detrás del grupo?')
assert.match(background,/JPEG adjunto/)
assert.match(background,/Resuelve la posición/)
assert.match(followupVisionPrompt('¿Cuántos están de pie?','breve'),/su suma coincide/)
assert.match(followupVisionPrompt('¿De qué color es la camisa del hombre del centro?','breve'),/aclaración corta/)
assert.match(followupVisionPrompt('¿Qué hay detrás?','breve'),/IDENTIFICA PRIMERO/)
assert.match(visualModeInstruction('breve'),/40 palabras/)
assert.equal(classifyVisualFollowUp('Lumi, dime la hora.'),null)
assert.ok(classifyVisualFollowUp('¿Cuántas personas están de pie y cuántas agachadas?'))
const session=new EphemeralVisualContext()
const image={mimeType:'image/jpeg' as const,data:'FAKE-JPEG-BYTES'}
const ticket=session.begin(image,100)
assert.equal(session.confirmAnalyzed(ticket,101),true)
assert.strictEqual(session.getForFollowUp('¿Cuántas personas están de pie y cuántas agachadas?',102)?.image,image)
session.clear()
assert.equal(session.getAuthorizedFrame(103),null)
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
assert.match(app,/visualReliabilityInstruction\(cameraIntent\?\.question \?\? said\)/)
assert.match(app,/followupVisionPrompt\(said,visionReplyMode\)/)
assert.match(app,/visualImage\)/)
assert.match(app,/captureLumiaAuthorizedStill\(stale,undefined,route.resolution\)/)
assert.doesNotMatch(visualReliabilityInstruction('¿Cómo está el clima?'),/su suma coincide/)
console.log('VISION-02.4.1 PASS: counting coherence, spatial ambiguity, conservative details, same-JPEG follow-ups and normal-turn isolation')
