#!/usr/bin/env node
/**
 * VA-02.0 / VQ-03 QA — safe, local-only baseline for EXISTING resident Kokoro.
 *
 * This does NOT optimize, retune, download or replace the TTS engine.
 * It measures identical short, fixed Spanish phrases twice, after warmup.
 * No mic, playback, network, raw audio saving, images, conversation data or
 * production file writes. Temporary WAVs are destroyed by the existing
 * synthesizeLocalSpeech adapter. No changes to Ollama/VRM/Whisper.
 */
import {performance} from 'node:perf_hooks'
import {homedir} from 'node:os'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {synthesizeLocalSpeech,isWave} from '../bridge/orbia/local-tts.mjs'
import {prewarmResidentKokoro} from '../bridge/orbia/resident-tts.mjs'
import {
  auditQaCheckout,makeVoiceQaChildEnv,
} from './lumia-vq03-local-voice-qa.mjs'

const SCRIPT_ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)))
export const VA02_TEST_PHRASES=Object.freeze([
  'Para lograr animaciones naturales, podemos suavizar las transiciones.',
  'Un controlador de estados coordina escucha, pensamiento y habla.',
  'Los gestos del avatar acompañan el diálogo sin interrumpir la voz.',
  'El rig se anima mediante clips, interpolaciones y movimientos pequeños.',
])

export function percentile(values,p){
  if(!Array.isArray(values)||!values.length||values.some(x=>!Number.isFinite(x)||x<0)){
    throw Error('VA02_INVALID_SAMPLES')
  }
  if(!Number.isFinite(p)||p<0||p>1)throw Error('VA02_INVALID_PERCENTILE')
  const sorted=[...values].sort((a,b)=>a-b)
  const k=Math.max(0,Math.ceil(p*sorted.length)-1)
  return Number(sorted[k].toFixed(1))
}

export async function measureVa02({
  synth,phrases=VA02_TEST_PHRASES,rounds=2,clock=()=>performance.now(),
}={}){
  if(typeof synth!=='function'||!Array.isArray(phrases)||!phrases.length ||
     phrases.length>8||phrases.some(x=>typeof x!=='string'||!x.trim()||x.length>250)||
     !Number.isInteger(rounds)||rounds<1||rounds>3){
    throw Error('VA02_INVALID_ARGUMENTS')
  }
  const observations=[]
  for(let round=1;round<=rounds;round++){
    for(let i=0;i<phrases.length;i++){
      const started=clock()
      const result=await synth(phrases[i])
      const elapsed=clock()-started
      if(!result||result.provider!=='kokoro-local-resident'||
         !isWave(result.audio)||!Number.isFinite(elapsed)||elapsed<0){
        throw Error('VA02_SYNTHESIS_OR_RESIDENT_FAILED')
      }
      observations.push({
        phrase:i+1,round,elapsedMs:Number(elapsed.toFixed(1)),
        wavBytes:result.audio.byteLength,
      })
    }
  }
  const times=observations.map(x=>x.elapsedMs)
  return {
    engine:'kokoro-local-resident',
    measures:'synthesis-plus-WAV-read; excludes Chrome playback and Qwen',
    phrases:phrases.length,rounds,
    observations,p50Ms:percentile(times,.5),
    p95Ms:percentile(times,.95),maxMs:percentile(times,1),
  }
}

async function main(){
  if(process.platform!=='win32')throw Error('VA02_WINDOWS_ONLY')
  if(process.cwd().toLowerCase()!==SCRIPT_ROOT.toLowerCase()){
    throw Error('VA02_RUN_FROM_QA_ROOT')
  }
  const original=join(homedir(),'LUMIA-ASUS')
  const qa=join(homedir(),'LUMIA-VQ03-QA')
  if(SCRIPT_ROOT.toLowerCase()!==resolve(qa).toLowerCase()){
    throw Error('VA02_NOT_ISOLATED_QA')
  }
  auditQaCheckout({original,qa})
  const child=makeVoiceQaChildEnv(original)
  if(child.missing.length)throw Error('VA02_MISSING_ORIGINAL_VOICE_ASSETS:'+child.missing.join(','))
  const env={...child.env,ORBIA_KOKORO_RESIDENT_ENABLED:'1'}
  const prepared=await prewarmResidentKokoro(env)
  if(!prepared?.ready)throw Error('VA02_RESIDENT_NOT_READY')

  // One warm-up call is excluded from measurements. No audio is retained.
  const warm=await synthesizeLocalSpeech('Prueba breve de voz local.',{env})
  if(warm.provider!=='kokoro-local-resident'||!isWave(warm.audio)){
    throw Error('VA02_WARMUP_NOT_RESIDENT')
  }
  console.log('[VA-02] Kokoro residente listo. 4 frases locales fijas, 2 rondas.')
  console.log('[VA-02] Sin micrófono, sin reproducción, sin archivos WAV persistentes.')
  const result=await measureVa02({
    synth:text=>synthesizeLocalSpeech(text,{env}),
  })
  for(const o of result.observations){
    console.log('[VA-02] frase '+o.phrase+' ronda '+o.round+': '+o.elapsedMs+' ms')
  }
  console.log('[VA-02] p50 '+result.p50Ms+' ms | p95 '+result.p95Ms+
    ' ms | max '+result.maxMs+' ms')
  console.log('[VA-02] Esta es la BASELINE de síntesis, NO una mejora A/B ni la latencia Chrome.')
  console.log('[VA-02] Cierra este proceso antes de iniciar de nuevo el laboratorio de voz.')
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  main().catch(error=>{
    const raw=String(error?.message??'')
    const known=/^VA02_[A-Z_]+(?::[a-zA-Z,]+)?$/.test(raw)
    console.error('[VA-02] '+(known?raw:'VA02_PREFLIGHT_OR_SYNTHESIS_FAILED'))
    process.exitCode=1
  })
}
