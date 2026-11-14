#!/usr/bin/env node
/**
 * VA-02.1: opt-in phase breakdown for the EXISTING Kokoro resident worker.
 * Uses same four fixed Spanish phrases, warm-up and two rounds as VA-02.0.
 * Python g2p / ONNX inference / sf.write, bridge FIFO wait/IPC/WAV read.
 *
 * Does NOT alter audio output, voice, model, concurrency, browser, scheduling
 * or the original LUMIA-ASUS checkout. No microphone, playback, persistent
 * recordings, transcripts, personal data, network or downloads.
 */
import {performance} from 'node:perf_hooks'
import {homedir} from 'node:os'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {synthesizeLocalSpeech,isWave} from '../bridge/orbia/local-tts.mjs'
import {
  prewarmResidentKokoro,lastResidentKokoroVa021Timing,stopResidentKokoroVa021,
} from '../bridge/orbia/resident-tts.mjs'
import {auditQaCheckout,makeVoiceQaChildEnv} from './lumia-vq03-local-voice-qa.mjs'
import {VA02_TEST_PHRASES,measureVa02,percentile} from './lumia-kokoro-latency-baseline-va02.mjs'

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)))
const METRICS=['g2pMs','inferenceMs','wavWriteMs','queueWaitMs','workerRoundTripMs','wavReadMs']
export function validateVa021Observation(value){
  if(!value||typeof value!=='object'||METRICS.some(k=>
    typeof value[k]!=='number'||!Number.isFinite(value[k])||
    value[k]<0||value[k]>30000))return null
  return Object.freeze(Object.fromEntries(METRICS.map(k=>[k,value[k]])))
}

export function summarizeVa021(observations){
  if(!Array.isArray(observations)||observations.length===0||
     observations.some(x=>!validateVa021Observation(x)))throw Error('VA021_INVALID_TIMINGS')
  return Object.freeze(Object.fromEntries(METRICS.map(k=>[
    k,{
      p50Ms:percentile(observations.map(x=>x[k]),.5),
      maxMs:percentile(observations.map(x=>x[k]),1),
    }
  ])))
}

async function main(){
  if(process.platform!=='win32')throw Error('VA021_WINDOWS_ONLY')
  const qa=join(homedir(),'LUMIA-VQ03-QA')
  const original=join(homedir(),'LUMIA-ASUS')
  if(resolve(qa).toLowerCase()!==ROOT.toLowerCase()||
     resolve(process.cwd()).toLowerCase()!==ROOT.toLowerCase()){
    throw Error('VA021_WRONG_QA_ROOT')
  }
  auditQaCheckout({original,qa})
  const voice=makeVoiceQaChildEnv(original)
  if(voice.missing.length)throw Error('VA021_MISSING_ASSETS')
  const env={
    ...voice.env,
    ORBIA_KOKORO_RESIDENT_ENABLED:'1',
    // This flag exists in the benchmark CHILD ONLY. Daily QA/ASUS unaffected.
    ORBIA_VA021_KOKORO_PROFILE:'1',
  }
  try {
    const prepared=await prewarmResidentKokoro(env)
  if(!prepared?.ready)throw Error('VA021_KOKORO_NOT_READY')
  const warm=await synthesizeLocalSpeech('Prueba breve de voz local.',{env})
  if(warm.provider!=='kokoro-local-resident'||!isWave(warm.audio)||
     !validateVa021Observation(lastResidentKokoroVa021Timing())){
    throw Error('VA021_WARMUP_UNPROFILED')
  }
  const details=[]
  const totals=await measureVa02({
    synth:async text=>{
      const output=await synthesizeLocalSpeech(text,{env})
      const snap=validateVa021Observation(lastResidentKokoroVa021Timing())
      if(!snap)throw Error('VA021_MISSING_PHASE_TIMINGS')
      details.push(snap)
      return output
    },
    phrases:VA02_TEST_PHRASES,
    rounds:2,
    clock:()=>performance.now(),
  })
  if(details.length!==8||totals.observations.length!==8){
    throw Error('VA021_INCOMPLETE_SAMPLE')
  }
  console.log('[VA-02.1] Perfil real de Kokoro residente, 4 frases × 2 rondas.')
  console.log('[VA-02.1] Python: fonemas, inferencia ONNX y escritura WAV; sin audio guardado.')
  for(let i=0;i<8;i++){
    const o=totals.observations[i],t=details[i]
    console.log('[VA-02.1] frase '+o.phrase+' ronda '+o.round+
      ': total '+o.elapsedMs+' ms | g2p '+t.g2pMs+
      ' | ONNX '+t.inferenceMs+' | WAV '+t.wavWriteMs+
      ' | cola '+t.queueWaitMs+
      ' | IPC '+t.workerRoundTripMs+' | lectura '+t.wavReadMs)
  }
  const stats=summarizeVa021(details)
  for(const k of METRICS){
    console.log('[VA-02.1] '+k+' p50 '+stats[k].p50Ms+
      ' ms | max '+stats[k].maxMs+' ms')
  }
  console.log('[VA-02.1] total p50 '+totals.p50Ms+
    ' ms | p95 '+totals.p95Ms+' ms | max '+totals.maxMs+' ms')
  console.log('[VA-02.1] Diagnóstico únicamente. No compara aún un cambio de voz ni mide reproducción Chrome.')
  } finally {
    // Return control to PowerShell; this closes only the benchmark's worker.
    stopResidentKokoroVa021(env)
  }
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  main().catch(e=>{
    const label=String(e?.message??'')
    console.error('[VA-02.1] '+(/^VA021_[A-Z_]+$/.test(label)?label:'VA021_PREFLIGHT_OR_SYNTHESIS_FAILED'))
    process.exitCode=1
  })
}
