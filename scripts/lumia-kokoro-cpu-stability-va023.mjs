#!/usr/bin/env node
/**
 * VA-02.3 — Balanced CPU-thread repeatability check, NOT an optimization.
 * From the user's VA-02.2 data: 2 threads clearly slower; 4 threads ≈ auto.
 * A-B-B-A order limits a simple first/last drift effect:
 *   auto -> 4 -> 4 -> auto
 * Exactly four fixed VA-02 Spanish phrases, two rounds per block.
 *
 * Each block starts a fresh resident, warms it, validates CPU provider,
 * records synthesis + WAV read time, and closes its own isolated worker.
 * Does not use mic, playback, network, audio storage, installs or production.
 */
import {homedir} from 'node:os'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {performance} from 'node:perf_hooks'
import {synthesizeLocalSpeech,isWave} from '../bridge/orbia/local-tts.mjs'
import {
  prewarmResidentKokoro,residentKokoroVa022Info,stopResidentKokoroVa022,
} from '../bridge/orbia/resident-tts.mjs'
import {auditQaCheckout,makeVoiceQaChildEnv} from './lumia-vq03-local-voice-qa.mjs'
import {VA02_TEST_PHRASES,measureVa02,percentile} from './lumia-kokoro-latency-baseline-va02.mjs'
import {validateVa022Candidate} from './lumia-kokoro-cpu-ab-va022.mjs'

export const VA023_ORDER=Object.freeze(['auto','4','4','auto'])
const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)))
const round=(x)=>Number(x.toFixed(1))
export function summarizeVa023(blocks){
  if(!Array.isArray(blocks)||blocks.length!==VA023_ORDER.length||
     blocks.some((x,i)=>x?.profile!==VA023_ORDER[i] ||
       !Array.isArray(x?.observations)||x.observations.length!==8 ||
       x.observations.some(o=>!Number.isFinite(o.elapsedMs)||o.elapsedMs<=0||
         !Number.isInteger(o.wavBytes)||o.wavBytes<44))){
    throw Error('VA023_INVALID_BLOCKS')
  }
  const a=[blocks[0],blocks[3]]
  const b=[blocks[1],blocks[2]]
  const times=xs=>xs.flatMap(x=>x.observations.map(o=>o.elapsedMs))
  const medA=percentile(times(a),.5),medB=percentile(times(b),.5)
  const pct=round((medB/medA-1)*100)
  const drift=round((blocks[3].p50Ms/blocks[0].p50Ms-1)*100)
  const warning=Math.abs(drift)>15
  return {
    auto:{p50Ms:medA,p95Ms:percentile(times(a),.95)},
    four:{p50Ms:medB,p95Ms:percentile(times(b),.95)},
    changePct:pct,autoDriftPct:drift,
    stableReference:!warning,
    // Screening threshold ONLY; never automatically changes the user system.
    candidateForMoreTesting:!warning && pct<=-10,
  }
}

async function main(){
  if(process.platform!=='win32')throw Error('VA023_WINDOWS_ONLY')
  const qa=join(homedir(),'LUMIA-VQ03-QA')
  const original=join(homedir(),'LUMIA-ASUS')
  if(resolve(qa).toLowerCase()!==ROOT.toLowerCase()||
     resolve(process.cwd()).toLowerCase()!==ROOT.toLowerCase()){
    throw Error('VA023_WRONG_QA_ROOT')
  }
  auditQaCheckout({original,qa})
  const voice=makeVoiceQaChildEnv(original)
  if(voice.missing.length)throw Error('VA023_MISSING_ORIGINAL_VOICE')
  const blocks=[]
  for(let index=0;index<VA023_ORDER.length;index++){
    const profile=VA023_ORDER[index]
    const env={
      ...voice.env,
      ORBIA_KOKORO_RESIDENT_ENABLED:'1',
      ORBIA_VA022_CPU_AB:'1',
      ORBIA_VA022_INTRA_THREADS:profile,
    }
    try {
      const ready=await prewarmResidentKokoro(env)
      if(!ready?.ready ||
         !validateVa022Candidate(residentKokoroVa022Info(),profile)){
        throw Error('VA023_CPU_SESSION_UNAVAILABLE')
      }
      const warm=await synthesizeLocalSpeech('Prueba breve de voz local.',{env})
      if(warm.provider!=='kokoro-local-resident'||!isWave(warm.audio)){
        throw Error('VA023_WARMUP_FAILED')
      }
      const result=await measureVa02({
        synth:text=>synthesizeLocalSpeech(text,{env}),
        phrases:VA02_TEST_PHRASES,
        rounds:2,clock:()=>performance.now(),
      })
      const block={profile,p50Ms:result.p50Ms,
        observations:result.observations}
      blocks.push(block)
      console.log('[VA-02.3] bloque '+(index+1)+' '+profile+
        ': p50 '+result.p50Ms+' ms | p95 '+result.p95Ms+' ms')
    } finally {
      stopResidentKokoroVa022(env)
    }
  }
  // Guard against gross output-length changes; not acoustic equivalence.
  for(let i=0;i<8;i++){
    const lengths=blocks.map(b=>b.observations[i].wavBytes)
    const min=Math.min(...lengths),max=Math.max(...lengths)
    if(max>min*1.05)throw Error('VA023_WAV_LENGTH_INCONSISTENT')
  }
  const report=summarizeVa023(blocks)
  console.log('[VA-02.3] auto agregado p50 '+report.auto.p50Ms+
    ' ms | p95 '+report.auto.p95Ms+' ms (16 muestras)')
  console.log('[VA-02.3] 4 hilos agregado p50 '+report.four.p50Ms+
    ' ms | p95 '+report.four.p95Ms+' ms (16 muestras)')
  console.log('[VA-02.3] 4 vs auto: '+report.changePct+
    ' % | deriva auto inicio-final: '+report.autoDriftPct+' %')
  if(!report.stableReference){
    console.log('[VA-02.3] REFERENCIA INESTABLE: deriva auto >15 %, NO extraer conclusión de rendimiento.')
  }else if(report.candidateForMoreTesting){
    console.log('[VA-02.3] 4 hilos merece validación independiente de calidad/audio y carga; NO aplicar aún.')
  }else{
    console.log('[VA-02.3] Sin ventaja >=10 % reproducible en mediana. Mantener auto.')
  }
  console.log('[VA-02.3] Ninguna configuración fue aplicada a LUMIA-ASUS.')
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  main().catch(e=>{
    const name=String(e?.message??'')
    console.error('[VA-02.3] '+(/^VA023_[A-Z_]+$/.test(name)?name:'VA023_PREFLIGHT_OR_SYNTHESIS_FAILED'))
    process.exitCode=1
  })
}
