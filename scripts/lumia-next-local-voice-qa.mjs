#!/usr/bin/env node
/**
 * LUMIA NEXT — unique cumulative QA launcher.
 * Runs only from LUMIA-NEXT-QA on the integration branch, preserving
 * the original ASUS checkout byte-for-byte and reusing Whisper/Kokoro in
 * child-only environment variables. Does not install models or copy data.
 *
 * Camera/CPU face detection still require explicit in-app authorization.
 */
import {existsSync,statSync,realpathSync} from 'node:fs'
import {spawn,execFileSync} from 'node:child_process'
import {homedir} from 'node:os'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import process from 'node:process'
import {makeVoiceQaChildEnv} from './lumia-vq03-local-voice-qa.mjs'
import {probeLocalVoiceCapabilities} from '../bridge/orbia/local-voice-probe.mjs'

export const ORIGINAL_SHA='1580a5182eba540893e35e37065be77da4ed014c'
export const NEXT_BRANCH='integration/lumia-asus-next-20261114'
const fileOk=(path)=>{try{return statSync(path).isFile()&&statSync(path).size>0}catch{return false}}
const git=(cwd,...args)=>execFileSync('git',args,{
  cwd,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe'],
}).trim()

export function auditNextCheckout({original,qa}){
  const source=realpathSync(original)
  const target=realpathSync(qa)
  if(source.toLowerCase()===target.toLowerCase())throw Error('NEXT_IS_PRODUCTION')
  if(git(source,'rev-parse','HEAD')!==ORIGINAL_SHA)throw Error('BASELINE_CHANGED')
  if(git(target,'branch','--show-current')!==NEXT_BRANCH)throw Error('WRONG_NEXT_BRANCH')
  if(git(target,'status','--porcelain'))throw Error('NEXT_DIRTY')
  return {nextSha:git(target,'rev-parse','HEAD'),originalSha:ORIGINAL_SHA}
}

async function main(){
  if(process.platform!=='win32')throw Error('NEXT_WINDOWS_ONLY')
  const qa=resolve(fileURLToPath(new URL('..',import.meta.url)))
  const original=join(homedir(),'LUMIA-ASUS')
  const expected=join(homedir(),'LUMIA-NEXT-QA')
  if(!existsSync(original)||!existsSync(expected))throw Error('CHECKOUT_MISSING')
  if(realpathSync(qa).toLowerCase()!==realpathSync(expected).toLowerCase()){
    throw Error('WRONG_NEXT_LOCATION')
  }
  const state=auditNextCheckout({original,qa})
  const child=makeVoiceQaChildEnv(original)
  if(child.missing.length)throw Error('VOICE_ASSETS_MISSING')
  const capabilities=probeLocalVoiceCapabilities({env:child.env})
  if(!capabilities.stt.localAvailable||!capabilities.tts.localAvailable){
    throw Error('VOICE_NOT_READY')
  }
  const launcher=join(qa,'INICIAR_LUMIA_ASUS_NEXT_QA.cmd')
  if(!fileOk(launcher))throw Error('NEXT_LAUNCHER_MISSING')
  execFileSync(process.execPath,[
    join(qa,'scripts','lumia-private-avatar-assets-vq03.mjs'),'--require',
  ],{cwd:qa,stdio:['ignore','inherit','inherit'],timeout:30000})

  console.log('[LUMIA NEXT] Integrated version:',state.nextSha.slice(0,12))
  console.log('[LUMIA NEXT] ASUS original protected:',state.originalSha.slice(0,12))
  console.log('[LUMIA NEXT] Avatar and vision in ONE QA process, 2B brain.')
  console.log('[LUMIA NEXT] Whisper/Kokoro paths shared read-only; no downloads or installs.')
  console.log('[LUMIA NEXT] Camera OFF until manual authorization; Ctrl+C to exit.')
  const worker=spawn('cmd.exe',['/d','/c',launcher],{
    cwd:qa,env:child.env,stdio:'inherit',windowsHide:false,
  })
  worker.on('error',()=>{
    console.error('[LUMIA NEXT] SPAWN_FAILED')
    process.exitCode=1
  })
  worker.on('exit',code=>{process.exitCode=code??1})
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  main().catch(err=>{
    const msg=String(err?.message??'')
    const safe=/^(NEXT_IS_PRODUCTION|BASELINE_CHANGED|WRONG_NEXT_BRANCH|NEXT_DIRTY|CHECKOUT_MISSING|WRONG_NEXT_LOCATION|VOICE_ASSETS_MISSING|VOICE_NOT_READY|NEXT_LAUNCHER_MISSING|NEXT_WINDOWS_ONLY)$/.test(msg)
    console.error('[LUMIA NEXT] '+(safe?msg:'PREFLIGHT_FAILED'))
    process.exitCode=1
  })
}
