import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {classifyExistingPhotoFollowup,visualDetailOfferMessage,visualReferenceClarification,calibratedVisionInstruction,isVisualReferenceAnswer,resolvedVisualReferencePrompt} from '../src/lib/vision-context-amr025'
import {EphemeralVisualContext,VISION_CONTEXT_TTL_MS} from '../src/lib/vision-context-vi023'
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

const cases=[
  ['Lumi, lee el texto de esta etiqueta',768,'offer-high-resolution'],
  ['Lumi, ¿qué dice este texto pequeño?',512,'offer-high-resolution'],
  ['¿Cuál es el número de serie de la placa?',768,'offer-high-resolution'],
  ['Lumi, lee el texto de esta etiqueta',1024,'proceed'],
  ['Lumi, de qué color es esto?',768,'clarify-reference'],
  ['Lumi, ¿qué es esto?',768,'clarify-reference'],
  ['Lumi, de qué color es la camisa del hombre del centro?',768,'proceed'],
  ['Lumi, ¿cuántas personas aparecen en la foto?',768,'proceed'],
  ['Lumi, describe la fotografía.',768,'proceed'],
] as const
for(const [q,edge,result] of cases){
 assert.equal(classifyExistingPhotoFollowup(q,edge),result,q)
}
assert.match(visualReferenceClarification(),/¿A qué objeto o persona/)
assert.equal(isVisualReferenceAnswer('La camisa del hombre de la derecha'),true)
assert.equal(isVisualReferenceAnswer('El de la izquierda'),true)
assert.equal(isVisualReferenceAnswer('Me refiero a la gorra'),true)
assert.equal(isVisualReferenceAnswer('¿Qué hora es?'),false)
assert.equal(isVisualReferenceAnswer('No'),false)
assert.equal(isVisualReferenceAnswer('Apaga las luces'),false)
assert.match(resolvedVisualReferencePrompt('¿De qué color es esto?','La camisa del hombre de la derecha'),/Pregunta original/)
assert.match(resolvedVisualReferencePrompt('¿De qué color es esto?','La camisa del hombre de la derecha'),/Aclaración explícita/)

assert.match(visualDetailOfferMessage('camera'),/No encenderé la cámara automáticamente/)
assert.match(visualDetailOfferMessage('file'),/archivo original/)
assert.match(visualDetailOfferMessage('none'),/cargar otra fotografía/)
assert.match(calibratedVisionInstruction(),/contar figuras visibles de identificar personas/)
assert.match(calibratedVisionInstruction(),/sin ambigüedades/)

// The owner selects a file in the existing viewer. No hidden storage or
// retained webcam stream; the source expires with the same JPEG/session.
const session=new EphemeralVisualContext()
const image={mimeType:'image/jpeg' as const,data:'SYNTHETIC-JPEG'}
const file={} as File
let ticket=session.begin(image,100,{kind:'file',resolution:768,originalFile:file})
assert.equal(session.getFrameSource(101),null, 'not yet analyzed')
assert.equal(session.getOriginalFileForReanalysis(101),null)
assert.equal(session.confirmAnalyzed(ticket,102),true)
assert.deepEqual(session.getFrameSource(103),{kind:'file',resolution:768,canReanalyzeOriginal:true,generation:ticket})
assert.equal(session.getOriginalFileForReanalysis(104)?.file,file)
assert.equal(session.getForFollowUp('Lumi, lee el texto de esta etiqueta',105)?.image,image)
// Closing explicitly revokes access to both bytes and original.
session.clear()
assert.equal(session.getOriginalFileForReanalysis(106),null)
assert.equal(session.getFrameSource(106),null)
// No file copy can appear on a camera-created still.
ticket=session.begin(image,200,{kind:'camera',resolution:768})
assert.equal(session.confirmAnalyzed(ticket,201),true)
assert.deepEqual(session.getFrameSource(202)?.canReanalyzeOriginal,false)
assert.equal(session.getOriginalFileForReanalysis(203),null)
// TTL applies to original photo too, not only derived JPEG.
ticket=session.begin(image,300,{kind:'file',resolution:512,originalFile:file})
assert.equal(session.confirmAnalyzed(ticket,301),true)
assert.equal(session.getOriginalFileForReanalysis(300+VISION_CONTEXT_TTL_MS+1),null)
assert.equal(session.hasAnalyzedFrame(300+VISION_CONTEXT_TTL_MS+2),false)

const app=read('src/App.tsx')
const viewer=read('src/ui/LumiaCameraViewfinder.tsx')
const context=read('src/lib/vision-context-vi023.ts')
const controller=read('src/lib/vision-context-amr025.ts')
const css=read('src/index.css')
const autoLauncher=read('INICIAR_LUMIA_ASUS_VISION_AUTO.cmd')
const newLauncher=read('INICIAR_LUMIA_ASUS_VISION_CONTEXTUAL.cmd')
const bridge=read('bridge/ollama.mjs')
assert.match(newLauncher,/set "VITE_LUMIA_VISION_CONTEXT_AMR025=1"/)
assert.match(newLauncher,/call "%~dp0INICIAR_LUMIA_ASUS_VISION_AUTO.cmd"/)
assert.doesNotMatch(autoLauncher,/VITE_LUMIA_VISION_CONTEXT_AMR025=1/)
assert.match(app,/const VISION_CONTEXT_AMR025_ENABLED = import\.meta\.env\.VITE_LUMIA_VISION_CONTEXT_AMR025 === '1'/)
assert.match(app,/classifyExistingPhotoFollowup\(said,frameSource\.resolution\)/)
assert.match(app,/visualDetailOfferMessage\(available\)/)
assert.match(app,/visualReferenceClarification\(\)/)
assert.match(app,/const resolvingReference=Boolean\(VISION_CONTEXT_AMR025_ENABLED/)
assert.match(app,/isVisualReferenceAnswer\(said\)/)
assert.match(app,/resolvedVisualReferencePrompt\(pendingReference,said\)/)
assert.match(app,/followupVisionPrompt\(visualQuestion,visionReplyMode\)/)
assert.match(app,/pendingReferenceQuestion\.current=null/)

assert.match(app,/calibratedVisionInstruction\(\)/)
assert.match(app,/const requestDetailedReanalysis = async \(\) =>/)
assert.match(app,/const highResolution=await prepareVisualImage\(selected\.file,1024\)/)
assert.match(app,/fresh\.generation!==selected\.generation/)
assert.match(app,/visualSession\.current\.getOriginalFileForReanalysis\(\)/)
assert.match(app,/detailedCameraQuestion\.current=question/)
assert.match(app,/setCameraPreviewOpen\(true\)/)
assert.match(app,/void respond\(question,highResolution,false,true\)/)
assert.match(app,/pendingVisualSource\.current=\{kind:'file',resolution/)
assert.match(app,/VISION_CONTEXT_AMR025_ENABLED && originalFile\?\{originalFile\}:\{\}/)
assert.match(app,/visualSession\.current\.begin\(visualImage,Date\.now\(\),source\)/)
assert.match(viewer,/onFileCaptured\(fileImage,selectedFile\.current,effectiveResolution\)/)
assert.match(viewer,/onCaptured\(image,effectiveResolution\)/)
assert.match(viewer,/onClick=\{onRequestDetailedReanalysis\}/)
assert.match(viewer,/visualContextReady && visualDetailOffer/)
assert.match(viewer,/Reanalizar archivo original a 1024 px/)
assert.match(viewer,/Volver a encuadrar a 1024 px/)
assert.match(css,/\.lumia-camera-detail-offer/)
assert.match(context,/if\(!this\.entry \|\| !this\.entry\.analyzed \|\| this\.expired\(now\)/)
assert.doesNotMatch(context,/\b(?:window|globalThis)\.(?:localStorage|sessionStorage)\b|\bindexedDB\.open\(|\bnew FileReader\(/)
assert.doesNotMatch(controller,/fetch\(|getUserMedia|localStorage|sessionStorage|setInterval\(/)
assert.doesNotMatch(newLauncher,/ollama\s+(?:rm|pull|create|stop)/i)
assert.match(bridge,/images: \[image\.data\]/)
assert.match(bridge,/think: false/)
assert.match(bridge,/inputTokens=/)
console.log('AMR-02.5 PASS: ambiguous follow-up clarification; OCR consent; source File and JPEG share 5-minute TTL; 1024px reanalysis from original; no automatic camera, no model changes')
