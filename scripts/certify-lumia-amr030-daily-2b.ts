import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {splitKokoroCompactPhrase,MAX_KOKORO_COMPACT_CHARS}
  from '../src/lib/kokoro-compact-phrases-amr030'
import {guardVisualPostureCount} from '../bridge/orbia/vision-posture-selfcheck-amr030.mjs'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

// Reproduce the actual observed local 2B contradiction, never invent 8.
const wrong='Seis personas visibles en el grupo, tres de ellos se encuentran sentados y cuatro de pie. No puedo confirmar sus nombres.'
const result=guardVisualPostureCount(wrong)
assert.equal(result.status,'posture-total-overflow')
assert.equal(result.claimedTotal,6)
assert.equal(result.claimedPostures,7)
assert.match(result.text,/no puedo confirmar la cantidad exacta/i)
assert.doesNotMatch(result.text,/\bocho\b|\b8\b/)

for(const good of [
  'Hay 8 personas visibles: siete de pie y una agachada al frente.',
  'Veo siete figuras humanas en una fotografía grupal al aire libre.',
  'Seis personas visibles, tres sentadas y dos de pie.',
  'Hay cuatro vehículos y dos sombras detrás del árbol.',
  'Tres personas de pie y dos sentadas.',
  'Veo seis personas, algunas parcialmente ocultas.',
  'En la foto aparecen una niña y un hombre.',
]){
  assert.equal(guardVisualPostureCount(good).text,good,good)
}
assert.equal(guardVisualPostureCount('Veo seis personas, tres sentadas y cuatro de pie.').status,'posture-total-overflow')
assert.equal(guardVisualPostureCount('Hay seis personas, tres sentadas y cuatro de pie.').status,'posture-total-overflow')
assert.equal(guardVisualPostureCount('Hay 6 personas, 3 sentadas y 4 de pie.').status,'posture-total-overflow')
assert.equal(guardVisualPostureCount('Hay 8 personas: 7 de pie y 1 agachada.').status,'no-proven-overflow')

// Test preservation and boundaries using sentences similar to the 11.7s TTS gap.
const long='No puedo identificar su nombre ni confirmar si es real, pero sí describo lo que veo: una figura central y un cuadro de retrato colgado en la pared.'
const parts=splitKokoroCompactPhrase(long)
assert.ok(parts.length>=2,JSON.stringify(parts))
assert.equal(parts.join(''),long)
assert.ok(parts.every(s=>s.trim() && s.length<=MAX_KOKORO_COMPACT_CHARS),JSON.stringify(parts))
assert.deepEqual(splitKokoroCompactPhrase('Hola. Soy Lumi.'),['Hola. Soy Lumi.'])
assert.deepEqual(splitKokoroCompactPhrase(''),[''])
const longNoPunctuation='Esta es una respuesta de la asistente local que tiene una secuencia de palabras suficientes para superar el maximo permitido por frase y medir la segmentacion sin destruir el contenido ni duplicar ninguna palabra del texto'
const segments=splitKokoroCompactPhrase(longNoPunctuation)
assert.equal(segments.join(''),longNoPunctuation)
assert.ok(segments.length>=2 && segments.every(s=>s.length<=MAX_KOKORO_COMPACT_CHARS))
assert.equal(splitKokoroCompactPhrase('X'.repeat(160)).join(''),'X'.repeat(160),'Do not slice inside one long word')

const launcher=read('INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd')
assert.match(launcher,/set "LUMIA_ASUS_MODEL_OVERRIDE=qwen3\.5:2b-q4_K_M"/)
assert.match(launcher,/set "VITE_LUMIA_VISION_ADAPTIVE_AMR027=0"/)
assert.match(launcher,/set "VITE_LUMIA_VISION_AUTO_AMR024=1"/)
assert.match(launcher,/set "ORBIA_LUMIA_VISUAL_POSTURE_GUARD_AMR030=1"/)
assert.match(launcher,/set "VITE_LUMIA_KOKORO_COMPACT_PHRASES=1"/)
assert.match(launcher,/INICIAR_LUMIA_ASUS_RAPIDA\.cmd/)
assert.doesNotMatch(launcher,/call .*INICIAR_LUMIA_ASUS_VISION4096|call .*INICIAR_LUMIA_ASUS_VISION_GRUPOS/i)
assert.doesNotMatch(launcher,/ollama (?:pull|rm|stop|create)/)

const base=read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
assert.match(base,/set "ORBIA_LUMIA_MODEL=qwen3\.5:2b-q4_K_M"/)
assert.match(base,/set "ORBIA_KOKORO_RESIDENT_ENABLED=1"/)
assert.match(base,/set "VITE_LUMIA_TTS_PREFETCH_NEXT=1"/)
assert.match(base,/if defined LUMIA_ASUS_MODEL_OVERRIDE/)
assert.match(read('INICIAR_LUMIA_ASUS_VISION4096.cmd'),/set "LUMIA_ASUS_MODEL_OVERRIDE=qwen3\.5:4b-vision4096"/)
assert.match(read('INICIAR_LUMIA_ASUS_VISION_GRUPOS.cmd'),/VITE_LUMIA_VISION_ADAPTIVE_AMR027=1/)
const tts=read('src/lib/tts.ts')
assert.match(tts,/const KOKORO_COMPACT_PHRASES = import\.meta\.env\.VITE_LUMIA_KOKORO_COMPACT_PHRASES === '1'/)
assert.match(tts,/localVoice\?\.requested\?\.ttsMode === 'local'/)
assert.match(tts,/splitKokoroCompactPhrase\(text\)/)
assert.match(tts,/if \(pumping && PREFETCH_NEXT_PHRASE\) prime\(queue\[0\]\)/)
assert.match(tts,/audioAbort\.abort\(\)/)
assert.match(tts,/notifyPhraseStart\(item\)/)

const bridge=read('bridge/ollama.mjs')
assert.match(bridge,/ORBIA_LUMIA_VISUAL_POSTURE_GUARD_AMR030==='1'/)
assert.match(bridge,/guardVisualPostureCount\(answer\)/)
assert.match(bridge,/onVisualAnswer\(selfCheck\.text\)/)
assert.doesNotMatch(bridge,/await .*guardVisualPostureCount/)

const check=spawnSync(process.execPath,['--check',
  fileURLToPath(new URL('../bridge/orbia/vision-posture-selfcheck-amr030.mjs',import.meta.url))],{encoding:'utf8'})
assert.equal(check.status,0,check.stderr)
console.log('AMR-03.0 PASS: opt-in 2B daily, limited local Kokoro phrase segmentation, privacy-safe posture overflow guard; existing 4B launcher unchanged')
