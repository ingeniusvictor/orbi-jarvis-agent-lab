/**
 * VI-04.1: safeguard for local, gitignored PH-04 VRM + 17 Motion R8 FBX.
 * --require: read-only; refuses to start a misleading legacy GLB fallback.
 * --doctor --from <path>: read-only report.
 * --copy --from <path>: explicit local-only copy of ignored private assets
 * from the user's OWN installed ASUS checkout to this QA worktree.
 * Never downloads, overwrites, commits, displays paths, or loads models.
 */
import {createHash} from 'node:crypto'
import {createReadStream} from 'node:fs'
import {copyFile,mkdir,lstat,realpath} from 'node:fs/promises'
import {constants as fsConstants,existsSync} from 'node:fs'
import {resolve,join,dirname,isAbsolute,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {motionCatalog} from '../src/scene/lumia-motion-r8/motion-library-catalog.js'

export const AVATAR_VRM_REL='public/models/lumia-motion/LUMIA_VITA_NATURAL_V05.vrm'
export const ASSETS=Object.freeze([
  AVATAR_VRM_REL,
  ...motionCatalog.map(({file})=>'public/models/lumia-motion/clips/'+file),
])
if(ASSETS.length!==18||new Set(ASSETS).size!==18||
   ASSETS.some(rel=>rel.includes('..')||rel.startsWith('/')||rel.includes('\\'))){
  throw Error('INVALID_ASSET_MANIFEST')
}
const root=resolve(fileURLToPath(new URL('../',import.meta.url)))

const fileInfo=async(path)=>{
  try{
    const st=await lstat(path)
    return st.isFile() && !st.isSymbolicLink() && st.size>0 ? st.size : null
  }catch(err){
    if(err?.code==='ENOENT')return null
    throw err
  }
}
const sha256=(path)=>new Promise((ok,bad)=>{
  const h=createHash('sha256')
  const stream=createReadStream(path)
  stream.on('data',chunk=>h.update(chunk))
  stream.once('error',bad)
  stream.once('end',()=>ok(h.digest('hex')))
})
export async function inspectAvatarAssets(directory){
  const assets=await Promise.all(ASSETS.map(async(relative)=>{
    const size=await fileInfo(join(directory,relative))
    return {relative,present:size!==null,bytes:size}
  }))
  return {
    files:assets,
    presentCount:assets.filter(a=>a.present).length,
    missing:assets.filter(a=>!a.present).map(a=>basename(a.relative)),
  }
}

export async function prepareAvatarAssets(source,target){
  const original=await realpath(source)
  const destination=await realpath(target)
  if(original===destination)throw Error('SOURCE_EQUALS_TARGET')
  if(!existsSync(join(original,'INICIAR_LUMIA_ASUS_RAPIDA.cmd'))){
    throw Error('SOURCE_NOT_LUMIA_CHECKOUT')
  }
  // The action is deliberately scoped to this experimental branch's launcher.
  if(!existsSync(join(destination,'INICIAR_LUMIA_ASUS_VISION_AUDITORIA_VI041.cmd'))){
    throw Error('DESTINATION_NOT_VI041_WORKTREE')
  }
  const from=await inspectAvatarAssets(original)
  if(from.missing.length)throw Error('SOURCE_MISSING_PRIVATE_ASSETS:'+from.missing.join(','))
  const to=await inspectAvatarAssets(destination)
  // Preflight every already-existing item, fail *before* copying anything.
  for(const item of to.files.filter(x=>x.present)){
    const [a,b]=await Promise.all([
      sha256(join(original,item.relative)),
      sha256(join(destination,item.relative)),
    ])
    if(a!==b)throw Error('DESTINATION_DIFFERENT_ASSET:'+basename(item.relative))
  }
  // A directory or special file at an expected path is a collision, not a
  // reason to forcefully overwrite it.
  for(const item of to.files.filter(x=>!x.present)){
    const full=join(destination,item.relative)
    if(existsSync(full))throw Error('DESTINATION_COLLISION:'+basename(full))
  }
  let copied=0
  for(const item of to.files.filter(x=>!x.present)){
    const src=join(original,item.relative)
    const dst=join(destination,item.relative)
    await mkdir(dirname(dst),{recursive:true})
    await copyFile(src,dst,fsConstants.COPYFILE_EXCL)
    const [a,b]=await Promise.all([sha256(src),sha256(dst)])
    if(a!==b)throw Error('COPY_INTEGRITY_FAILED:'+basename(dst))
    copied++
  }
  const result=await inspectAvatarAssets(destination)
  if(result.missing.length)throw Error('INCOMPLETE_PRIVATE_ASSET_SETUP')
  return {copied,alreadyPresent:ASSETS.length-copied,verified:true}
}

async function main(argv){
  const mode=argv.includes('--copy')?'copy':argv.includes('--require')?'require':argv.includes('--doctor')?'doctor':null
  if(!mode||['--copy','--require','--doctor'].filter(x=>argv.includes(x)).length!==1){
    throw Error('SELECT_EXACTLY_ONE_MODE')
  }
  const sourceIndex=argv.indexOf('--from')
  const source=sourceIndex>=0?argv[sourceIndex+1]:null
  if(mode==='copy'&&(!source||!isAbsolute(source)))throw Error('ABSOLUTE_SOURCE_REQUIRED')
  if(sourceIndex>=0&&(!source||!isAbsolute(source)))throw Error('ABSOLUTE_SOURCE_REQUIRED')
  const current=await inspectAvatarAssets(root)
  if(mode==='require'){
    if(current.missing.length){
      console.error('[LUMIA VI-04.1] Falta VRM/FBX privado en este worktree: '+current.missing.join(', '))
      console.error('No se arrancara el avatar GLB antiguo. Copia local voluntaria: node scripts/lumia-private-avatar-assets.mjs --copy --from "C:\\Users\\...\\LUMIA-ASUS"')
      return 2
    }
    console.log('[LUMIA VI-04.1] PH-04 PRE-FLIGHT OK: VRM + 17 FBX locales presentes.')
    return 0
  }
  if(mode==='doctor'){
    const original=source?await inspectAvatarAssets(resolve(source)):null
    console.log(JSON.stringify({
      lab:'LUMIA-VI041-PRIVATE-ASSET-PREFLIGHT',mode:'doctor_read_only',
      destination:{present:current.presentCount,total:ASSETS.length,missing:current.missing},
      source:original?{present:original.presentCount,total:ASSETS.length,missing:original.missing}:null,
      writes:0,network:false,microphone:false,camera:false,
    }))
    return 0
  }
  const prepared=await prepareAvatarAssets(resolve(source),root)
  console.log(JSON.stringify({
    lab:'LUMIA-VI041-PRIVATE-ASSET-PREFLIGHT',ok:true,mode:'explicit_local_copy',
    files:ASSETS.length,...prepared,network:false,microphone:false,camera:false,
    original_modified:false,
  }))
  return 0
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main(process.argv.slice(2)).then(code=>process.exitCode=code).catch(err=>{
    // no stacks or private paths: only predefined codes, filenames.
    const message=String(err?.message||'UNKNOWN')
    const safe=/^(SOURCE_MISSING_PRIVATE_ASSETS:|DESTINATION_DIFFERENT_ASSET:|DESTINATION_COLLISION:|COPY_INTEGRITY_FAILED:)/.test(message)
    console.error('[LUMIA VI-04.1] '+(safe?message:'PRIVATE_ASSET_SETUP_FAILED'))
    process.exitCode=1
  })
}
