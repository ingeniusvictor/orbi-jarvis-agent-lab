#!/usr/bin/env node
/**
 * VA-02.2: observational local CPU-thread A/B for Kokoro; DOES NOT change
 * production config, installed Python/ONNX, weights, voice, VAD or VRM.
 * Sequential profiles: default(auto), 2, 4. Warm each independently.
 * Each profile's Python resident is closed before the next starts.
 * No audio playback/storage or microphone. Temporary WAVs are cleaned by
 * synthesizeLocalSpeech. CPU provider must be confirmed for comparability.
 */
import {homedir} from 'node:os'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {performance} from 'node:perf_hooks'
import {synthesizeLocalSpeech,isWave} from '../bridge/orbia/local-tts.mjs'
import {
  prewarmResidentKokoro,residentKokoroVa022Info,stopResidentKokoroVa022,
  lastResidentKokoroVa021Timing,
} from '../bridge/orbia/resident-tts.mjs'
import {auditQaCheckout,makeVoiceQaChildEnv} from './lumia-vq03-local-voice-qa.mjs'
import {VA02_TEST_PHRASES,measureVa02,percentile} from './lumia-kokoro-latency-baseline-va02.mjs'

export const VA022_PROFILES=Object.freeze(['auto','2','4'])
const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)))

export function validateVa022Candidate(info,expected){
  return Boolean(info && info.threads===expected &&
    Array.isArray(info.providers) && info.providers.length===1 &&
    info.providers[0]==='CPUExecutionProvider')
}
export function compareVa022Results(results){
  if(!Array.isArray(results)||results.length!==VA022_PROFILES.length||
    results.some((x,i)=>x?.profile!==VA022_PROFILES[i] ||
      !Number.isFinite(x.p50Ms)||x.p50Ms<=0 || !Number.isFinite(x.p95Ms))){
    throw Error('VA022_BAD_RESULTS')
  }
  const baseline=results[0].p50Ms
  return results.map(x=>({
    profile:x.profile,p50Ms:x.p50Ms,p95Ms:x.p95Ms,
    changePct:Number(((x.p50Ms/baseline-1)*100).toFixed(1)),
  }))
}
async function main(){
  if(process.platform!=='win32')throw Error('VA022_WINDOWS_ONLY')
  const qa=join(homedir(),'LUMIA-VQ03-QA')
  if(resolve(qa).toLowerCase()!==ROOT.toLowerCase()||
     resolve(process.cwd()).toLowerCase()!==ROOT.toLowerCase()){
    throw Error('VA022_WRONG_QA_ROOT')
  }
  auditQaCheckout({original:join(homedir(),'LUMIA-ASUS'),qa})
  const voice=makeVoiceQaChildEnv(join(homedir(),'LUMIA-ASUS'))
  if(voice.missing.length)throw Error('VA022_MISSING_ASSETS')

  const results=[]
  for(const profile of VA022_PROFILES){
    const env={
      ...voice.env,
      ORBIA_KOKORO_RESIDENT_ENABLED:'1',
      ORBIA_VA021_KOKORO_PROFILE:'1',
      ORBIA_VA022_CPU_AB:'1',
      ORBIA_VA022_INTRA_THREADS:profile,
    }
    try {
      const ready=await prewarmResidentKokoro(env)
      const info=residentKokoroVa022Info()
      if(!ready?.ready||!validateVa022Candidate(info,profile)){
        throw Error('VA022_CPU_PROVIDER_OR_AB_UNAVAILABLE')
      }
      const warm=await synthesizeLocalSpeech('Prueba breve de voz local.',{env})
      if(warm.provider!=='kokoro-local-resident'||!isWave(warm.audio)){
        throw Error('VA022_WARMUP_FAILED')
      }
      const onnxTimes=[]
      const timing=await measureVa02({
        phrases:VA02_TEST_PHRASES,rounds:2,clock:()=>performance.now(),
        synth:async text=>{
          const out=await synthesizeLocalSpeech(text,{env})
          const phase=lastResidentKokoroVa021Timing()
          if(!phase||!Number.isFinite(phase.inferenceMs)){
            throw Error('VA022_TIMING_MISSING')
          }
          onnxTimes.push(phase.inferenceMs)
          return out
        },
      })
      const result={
        profile,p50Ms:timing.p50Ms,p95Ms:timing.p95Ms,
        onnxP50Ms:percentile(onnxTimes,.5),
        observations:timing.observations.map(o=>({
          phrase:o.phrase,round:o.round,elapsedMs:o.elapsedMs,
          wavBytes:o.wavBytes,
        })),
      }
      results.push(result)
      console.log('[VA-02.2] perfil '+profile+' (CPU): p50 '+result.p50Ms+
        ' ms | p95 '+result.p95Ms+' ms | ONNX p50 '+result.onnxP50Ms+' ms')
    } finally {
      stopResidentKokoroVa022(env)
    }
  }
  // Compare output lengths conservatively; exact waveform identity still
  // requires controlled listening and sound-quality evaluation.
  for(let i=0;i<8;i++){
    const sizes=results.map(r=>r.observations[i]?.wavBytes)
    const low=Math.min(...sizes), high=Math.max(...sizes)
    if(low<44||high>low*1.05){
      throw Error('VA022_OUTPUT_LENGTH_DIFFERENCE')
    }
  }
  for(const row of compareVa022Results(results)){
    console.log('[VA-02.2] comparacion '+row.profile+
      ': p50 '+row.p50Ms+' ms | variacion '+row.changePct+' %')
  }
  console.log('[VA-02.2] Exploratorio: mismo modelo y 8 muestras por perfil. '+
    'No demuestra mejora audible ni calidad idéntica. Nada se aplicó a LUMIA-ASUS.')
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  main().catch(e=>{
    const label=String(e?.message??'')
    console.error('[VA-02.2] '+(/^VA022_[A-Z_]+$/.test(label)?label:'VA022_PREFLIGHT_OR_INFERENCE_FAILED'))
    process.exitCode=1
  })
}
