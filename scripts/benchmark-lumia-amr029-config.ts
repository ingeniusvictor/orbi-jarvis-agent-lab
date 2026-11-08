/**
 * AMR-02.9: compare the *same* prompts between the owner's installed 2B and
 * customised 4B, without changing Ollama tags, Modelfiles, GPU or runtime.
 * This only emits JSON with public benchmark questions and LUMIA's canonical
 * instructions. Never fetches a photo, invokes Ollama, mic or TTS.
 */
import {composeLumiaVoiceSystemPrompt} from '../bridge/orbia/lumia-identity.mjs'
import {visualReliabilityInstruction,visualModeInstruction} from '../src/lib/vision-context-vi023'
import {visionSpeechBudget} from '../src/lib/vision-routing-amr024'
import {calibratedVisionInstruction} from '../src/lib/vision-context-amr025'
import {visualPrecisionInstruction} from '../src/lib/vision-trace-amr026'

const system=composeLumiaVoiceSystemPrompt({toolsEnabled:false,knowledgeEnabled:false})
const visualQuestion='Lumi, observa cuidadosamente esta fotografía. Cuenta las personas visibles de izquierda a derecha, incluyendo a quien esté delante del grupo. ¿Cuántas personas hay en total, cuántas están de pie y cuántas están agachadas?'
const visualRequest='Analiza exclusivamente esta imagen puntual capturada con permiso del usuario. '+
  'Responde en español a esta solicitud: '+visualQuestion+
  '. No supongas movimiento ni imágenes anteriores. Diferencia observaciones de hipótesis.'+
  visualReliabilityInstruction(visualQuestion)+
  visualModeInstruction('breve')+
  visionSpeechBudget('breve',true)+
  calibratedVisionInstruction()+
  visualPrecisionInstruction(visualQuestion)
const visualSystem=system+
  '\nEstás examinando una foto proporcionada expresamente por el usuario. '+
  'Describe observaciones visuales; distingue claramente hipótesis. '+
  'No inventes detalles, y no repitas teléfonos ni identificadores privados. '+
  'Responde en español con frases naturales, breves y completas.'
const voiceQuestion='Lumi, si un inversor fotovoltaico deja de generar y no veo alarmas, ¿qué revisarías primero sin intervenir equipos energizados? Responde en dos frases.'
const tasks=[
  {id:'texto-simple',kind:'written',question:'Explica en español en dos frases qué es un string fotovoltaico y cuál es el papel de un inversor.',numPredict:192},
  {id:'texto-razonamiento',kind:'written',question:'En una planta solar, un string entrega 8 A y otro comparable entrega 10 A. ¿Cuánto menor es la corriente del primero respecto del segundo, en porcentaje? Muestra la operación y menciona una verificación segura antes de manipular conectores.',numPredict:224},
  {id:'voz-modelo',kind:'speech-ready',question:voiceQuestion,numPredict:120},
  {id:'imagen',kind:'image',question:visualRequest,numPredict:256},
]
const json=JSON.stringify({model2B:'qwen3.5:2b',model4B:'qwen3.5:4b-vision4096',
  system,visualSystem,visualQuestion,voiceQuestion,tasks,
  format:{type:'object',properties:{respuesta:{type:'string'}},required:['respuesta'],additionalProperties:false},
  options:{temperature:0,num_ctx:4096},keepAlive:'5m'})
// Windows PowerShell 5.1 may decode native stdout using an OEM codepage.
// Escape all non-ASCII JSON code units so the questions survive unchanged.
// JSON.parse in PowerShell restores the original Unicode text and accents.
const ascii=json.replace(/[^\x00-\x7f]/g,(character)=>
  '\\u'+character.charCodeAt(0).toString(16).padStart(4,'0'))
process.stdout.write(ascii)
