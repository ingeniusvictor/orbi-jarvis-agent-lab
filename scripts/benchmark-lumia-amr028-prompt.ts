/**
 * AMR-02.8 — read-only, isolated benchmark prompt matching the AMR-02.7
 * authorized new-still speech instructions. Does not access webcam, image
 * files, GitHub, cloud providers, environment secrets or the user transcript.
 */
import {composeLumiaVoiceSystemPrompt} from '../bridge/orbia/lumia-identity.mjs'
import {visualOptionsForModel} from '../bridge/orbia/vision-profile-amr021.mjs'
import {visualReliabilityInstruction,visualModeInstruction} from '../src/lib/vision-context-vi023'
import {visionSpeechBudget} from '../src/lib/vision-routing-amr024'
import {calibratedVisionInstruction} from '../src/lib/vision-context-amr025'
import {visualPrecisionInstruction} from '../src/lib/vision-trace-amr026'

const question=process.argv.slice(2).join(' ').trim()
if(!question || question.length>1200){
  process.stderr.write('La pregunta del benchmark debe contener entre 1 y 1200 caracteres.\n')
  process.exitCode=2
}else{
  const model='qwen3.5:4b-vision4096'
  const request='Analiza exclusivamente esta imagen puntual capturada con permiso del usuario. '+
    'Responde en español a esta solicitud: '+question+
    '. No supongas movimiento ni imágenes anteriores. Diferencia observaciones de hipótesis.'+
    visualReliabilityInstruction(question)+
    visualModeInstruction('breve')+
    visionSpeechBudget('breve',true)+
    calibratedVisionInstruction()+
    visualPrecisionInstruction(question)
  const system=composeLumiaVoiceSystemPrompt({toolsEnabled:false,knowledgeEnabled:false})+
    '\nEstás examinando una foto proporcionada expresamente por el usuario. '+
    'Describe observaciones visuales; distingue claramente hipótesis. '+
    'No inventes detalles, y no repitas teléfonos ni identificadores privados. '+
    'Responde en español con frases naturales, breves y completas.'
  process.stdout.write(JSON.stringify({
    model,
    system,
    request,
    options:visualOptionsForModel(model),
    keepAlive:'30m'
  }))
}
