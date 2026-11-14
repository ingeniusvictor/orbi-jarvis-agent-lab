#!/usr/bin/env node
/**
 * VQ-03.3, Windows-only. Starts isolated VQ-03 QA with local Whisper/Kokoro
 * already installed inside the owner's protected LUMIA-ASUS checkout.
 *
 * NO installation, NO copy, NO symlink, NO file modifications, NO account
 * access, NO writes to LUMIA-ASUS or global environment. Child-scoped paths.
 * Stop both parent/child with Ctrl-C in the same terminal.
 *
 * This is an OPTIONAL launcher. The normal QA/production launchers remain
 * untouched. Readiness is file-presence only until speech is physically tested.
 */
import {existsSync,realpathSync,statSync} from 'node:fs'
import {spawn,execFileSync} from 'node:child_process'
import {homedir} from 'node:os'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import process from 'node:process'
import {probeLocalVoiceCapabilities} from '../bridge/orbia/local-voice-probe.mjs'

export const ORIGINAL_ASUS_SHA='1580a5182eba540893e35e37065be77da4ed014c'
export const VQ03_BRANCH='feature/lumia-vq03-vrm-intent-clarity-20261113'

function git(cwd,...args){
  return execFileSync('git',args,{
    cwd,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe'],
  }).trim()
}
const fileOk=(p)=>{try{return statSync(p).isFile()&&statSync(p).size>0}catch{return false}}

export function resolveOriginalVoiceFiles(original,{exists=fileOk}={}){
  const runtime=join(original,'.local-runtime')
  const required={
    sttCommand:[
      join(runtime,'whisper.cpp','bin','Release','whisper-cli.exe'),
      join(runtime,'whisper.cpp','build','bin','Release','whisper-cli.exe'),
      join(runtime,'whisper.cpp','main.exe'),
    ].find(exists)||null,
    sttModel:[
      join(runtime,'whisper.cpp','models','ggml-base.bin'),
      join(runtime,'whisper.cpp','models','ggml-small.bin'),
    ].find(exists)||null,
    ttsPython:join(runtime,'kokoro','.venv','Scripts','python.exe'),
    ttsScript:join(original,'bridge','runtime','kokoro','synthesize.py'),
    ttsModel:join(runtime,'kokoro','models','kokoro-v1.0.onnx'),
    ttsVoices:join(runtime,'kokoro','models','voices-v1.0.bin'),
  }
  const missing=Object.entries(required).filter(([,p])=>!p||!exists(p)).map(([k])=>k)
  return {required,missing}
}
export function makeVoiceQaChildEnv(original,baseEnv=process.env,{exists=fileOk}={}){
  const {required,missing}=resolveOriginalVoiceFiles(original,{exists})
  if(missing.length) return {env:null,missing}
  return {
    env:{
      ...baseEnv,
      ORBI_LOCAL_STT_COMMAND:required.sttCommand,
      ORBI_LOCAL_STT_MODEL:required.sttModel,
      ORBI_LOCAL_TTS_PYTHON:required.ttsPython,
      ORBI_LOCAL_TTS_SCRIPT:required.ttsScript,
      ORBI_LOCAL_TTS_MODEL:required.ttsModel,
      ORBI_LOCAL_TTS_VOICES:required.ttsVoices,
      // Preserve original Python code/assets on disk, no bytecode generated.
      PYTHONDONTWRITEBYTECODE:'1',
    },
    missing:[],
  }
}

export function auditQaCheckout({original,qa}){
  const src=realpathSync(original)
  const dst=realpathSync(qa)
  if(src.toLowerCase()===dst.toLowerCase())throw Error('QA_IS_PRODUCTION_SOURCE')
  if(git(src,'rev-parse','HEAD')!==ORIGINAL_ASUS_SHA)throw Error('BASELINE_CHANGED')
  if(git(dst,'branch','--show-current')!==VQ03_BRANCH)throw Error('WRONG_QA_BRANCH')
  if(git(dst,'status','--porcelain'))throw Error('QA_HAS_UNCOMMITTED_CHANGES')
  return {qaSha:git(dst,'rev-parse','HEAD'),originalSha:ORIGINAL_ASUS_SHA}
}

async function main(){
  if(process.platform!=='win32')throw Error('QA_LAUNCHER_WINDOWS_ONLY')
  const qa=resolve(fileURLToPath(new URL('..',import.meta.url)))
  const original=join(homedir(),'LUMIA-ASUS')
  if(!existsSync(original)||!existsSync(qa))throw Error('MISSING_ASUS_OR_QA_FOLDER')

  const branch=auditQaCheckout({original,qa})
  const preflight=spawnSyncNode([
    join(qa,'scripts','lumia-private-avatar-assets-vq03.mjs'),'--require'
  ],{cwd:qa})
  if(preflight!==0)throw Error('PRIVATE_VRM_R8_MISSING')

  const childConfig=makeVoiceQaChildEnv(original)
  if(childConfig.missing.length){
    throw Error('VOICE_ASSETS_NOT_FOUND_IN_ORIGINAL:'+childConfig.missing.join(','))
  }
  const report=probeLocalVoiceCapabilities({env:childConfig.env})
  if(!report.stt.localAvailable||!report.tts.localAvailable){
    throw Error('VOICE_PROBE_FAILED')
  }
  const launcher=join(qa,'INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd')
  if(!fileOk(launcher))throw Error('VQ03_LAUNCHER_MISSING')
  console.log('[VQ-03.3] QA branch:',branch.qaSha.slice(0,12))
  console.log('[VQ-03.3] protected baseline:',branch.originalSha.slice(0,12))
  console.log('[VQ-03.3] 18 private avatar assets present; local Whisper/Kokoro paths present.')
  console.log('[VQ-03.3] Child-only paths, no downloads/installation/copy/symlinks.')
  console.log('[VQ-03.3] This is NOT proof that speech works; check effective runtime after startup.')
  console.log('[VQ-03.3] Ctrl-C to close. Do not start production simultaneously.')
  const child=spawn('cmd.exe',['/d','/c',launcher],{
    cwd:qa,env:childConfig.env,stdio:'inherit',windowsHide:false,
  })
  child.on('error',()=>{console.error('[VQ-03.3] CMD_LAUNCH_ERROR');process.exitCode=1})
  child.on('exit',(code)=>{process.exitCode=code??1})
}
function spawnSyncNode(args,{cwd}){
  try{
    execFileSync(process.execPath,args,{
      cwd,timeout:30000,stdio:['ignore','inherit','inherit'],
    })
    return 0
  }catch{return 1}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  main().catch(e=>{
    // Errors contain only component names or statuses, never private paths.
    const known=/^(QA_IS_PRODUCTION_SOURCE|BASELINE_CHANGED|WRONG_QA_BRANCH|QA_HAS_UNCOMMITTED_CHANGES|MISSING_ASUS_OR_QA_FOLDER|PRIVATE_VRM_R8_MISSING|VOICE_ASSETS_NOT_FOUND_IN_ORIGINAL|VOICE_PROBE_FAILED|VQ03_LAUNCHER_MISSING|QA_LAUNCHER_WINDOWS_ONLY)/
    console.error('[VQ-03.3] '+(known.test(String(e?.message))?e.message:'LOCAL_PREFLIGHT_FAILED'))
    process.exitCode=1
  })
}
