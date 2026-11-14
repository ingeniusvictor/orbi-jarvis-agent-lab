#!/usr/bin/env node
/**
 * LUMIA MASTER LM-01 — source-respecting local audit + opt-in backup.
 *
 * --audit --source DIR: READ ONLY, prints status without private file contents.
 * --backup --source DIR --dest DIR: requires the exact known baseline, clean
 *   Git worktree and all 18 private VRM/R8 assets. Writes OUTSIDE the source
 *   only, NEVER edits source/repo, never downloads/uploads anything.
 * --verify --backup-dir DIR: verify manifest + contents of a completed backup.
 *
 * Does NOT copy runtime caches, passwords, other user files, Ollama blobs or
 * private data other than the explicit VRM/FBX allowlist. No "full system"
 * backup or physical regression testing is claimed.
 *
 * No npm packages; node >=20 and git required. Win/Linux compatible.
 */
import {createHash,randomUUID} from 'node:crypto'
import {createReadStream} from 'node:fs'
import {copyFile,mkdir,lstat,readFile,realpath,rename,rm,stat,writeFile} from 'node:fs/promises'
import {constants} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {basename,dirname,isAbsolute,join,relative,resolve,sep} from 'node:path'
import process from 'node:process'

export const BASELINE_SHA='1580a5182eba540893e35e37065be77da4ed014c'
export const PRIVATE_VRM='public/models/lumia-motion/LUMIA_VITA_NATURAL_V05.vrm'
export const MOTION_FILES=[
  'Waving.fbx','Talking.fbx','Idle.fbx','Head Gesture.fbx',
  'Dwarf Idle.fbx','Thinking.fbx','Pointing.fbx','Pointing Gesture.fbx',
  'No.fbx','Happy.fbx','Excited.fbx','Surprised.fbx','Clapping.fbx',
  'Blow A Kiss.fbx','Walking in place.fbx','Walking adelante.fbx',
  'Walk In Circle.fbx',
]
export const REQUIRED_ASSETS=Object.freeze([
  PRIVATE_VRM,
  ...MOTION_FILES.map(name=>'public/models/lumia-motion/clips/'+name),
])
export const OPTIONAL_ASSETS=Object.freeze([
  'public/models/lumia/lumia.glb',
  'public/models/vision/blaze_face_short_range.tflite',
])

if(REQUIRED_ASSETS.length!==18||new Set(REQUIRED_ASSETS).size!==18 ||
   [...REQUIRED_ASSETS,...OPTIONAL_ASSETS].some(p=>p.includes('..')||p.startsWith('/')||p.includes('\\'))){
  throw Error('INVALID_ASSET_ALLOWLIST')
}
const norm=p=>process.platform==='win32'?resolve(p).toLowerCase():resolve(p)
const isContained=(a,b)=>{const rel=relative(norm(a),norm(b));return rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel))}
const runGit=(cwd,args,timeout=20000)=>execFileSync('git',args,{
  cwd,encoding:'utf8',timeout,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe'],
}).trim()
const validFile=async p=>{
  try {
    const s=await lstat(p)
    return s.isFile()&&!s.isSymbolicLink()&&s.size>0 ? s.size : null
  }catch(e){if(e?.code==='ENOENT')return null;throw e}
}
const hashFile=path=>new Promise((resolve,reject)=>{
  const h=createHash('sha256')
  const stream=createReadStream(path)
  stream.on('data',b=>h.update(b))
  stream.once('error',reject)
  stream.once('end',()=>resolve(h.digest('hex')))
})
const listModels=()=>{
  try {
    const out=execFileSync('ollama',['list'],{
      encoding:'utf8',timeout:4000,maxBuffer:512000,
      stdio:['ignore','pipe','ignore'],
    })
    return out.trim().split(/\r?\n/).slice(1).map(line=>line.trim().split(/\s+/)[0]).filter(Boolean)
  }catch{return []}
}
export async function auditProject(source,{expectedCommit=BASELINE_SHA,models=false}={}){
  const root=await realpath(source)
  const reported=await realpath(runGit(root,['rev-parse','--show-toplevel']))
  if(norm(root)!==norm(reported))throw Error('SOURCE_MUST_BE_EXACT_GIT_ROOT')
  const sha=runGit(root,['rev-parse','HEAD'])
  const branch=runGit(root,['branch','--show-current'])||'(detached HEAD)'
  const status=runGit(root,['status','--porcelain','--untracked-files=normal'])
  const assets=await Promise.all(
    REQUIRED_ASSETS.map(async p=>({path:p,bytes:await validFile(join(root,p))})),
  )
  const optional=await Promise.all(
    OPTIONAL_ASSETS.map(async p=>({path:p,bytes:await validFile(join(root,p))})),
  )
  const requiredMissing=assets.filter(a=>a.bytes===null).map(a=>basename(a.path))
  const ignoredRuntimeExists=await lstat(join(root,'.local-runtime')).then(s=>s.isDirectory()).catch(e=>{
    if(e?.code==='ENOENT')return false
    throw e
  })
  const launcherNames=[
    'INICIAR_LUMIA_ASUS_RAPIDA.cmd',
    'INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd',
  ]
  const launchers=Object.fromEntries(await Promise.all(
    launcherNames.map(async name=>[name,(await validFile(join(root,name)))!==null]),
  ))
  return {
    source:root,branch,commit:sha,
    expected_commit_match:sha===expectedCommit,
    clean_worktree:status.length===0,
    changed_or_untracked_entry_count:status?status.split(/\r?\n/).length:0,
    required_assets_total:REQUIRED_ASSETS.length,
    required_assets_present:assets.length-requiredMissing.length,
    required_assets_missing:requiredMissing,
    optional_assets_present:optional.filter(x=>x.bytes!==null).map(x=>basename(x.path)),
    ignored_local_runtime_present:ignoredRuntimeExists,
    launchers,ollama_model_names:models?listModels():null,
    private_assets:assets,optional_assets:optional,
    no_audio_tested:true,no_visual_tested:true,
    source_modified:false,
  }
}
const publiclySafeAudit=a=>({
  lab:'LUMIA-MASTER-LM01',mode:'read_only_audit',
  branch:a.branch,commit:a.commit,expected_commit_match:a.expected_commit_match,
  clean_worktree:a.clean_worktree,
  changed_or_untracked_entry_count:a.changed_or_untracked_entry_count,
  required_assets_present:a.required_assets_present,
  required_assets_total:a.required_assets_total,
  required_assets_missing:a.required_assets_missing,
  optional_assets_present:a.optional_assets_present,
  ignored_local_runtime_present:a.ignored_local_runtime_present,
  launchers:a.launchers,ollama_model_names:a.ollama_model_names,
  microphone_accessed:false,camera_accessed:false,source_modified:false,
  files_written:0,network_access:false,
  physical_avatar_or_voice_qa:false,
})
const relAsset=(path)=>'private-assets/'+path
const getFileMeta=async(full,relativePath)=>{
  const s=await lstat(full)
  if(!s.isFile()||s.isSymbolicLink()||s.size<=0)throw Error('NOT_REGULAR_ASSET')
  return {path:relativePath,bytes:s.size,sha256:await hashFile(full)}
}
const validateManifestPath=(p)=>typeof p==='string'&&
  p.startsWith('private-assets/')&&!p.includes('..')&&!p.includes('\\')&&
  (REQUIRED_ASSETS.includes(p.slice('private-assets/'.length))||
   OPTIONAL_ASSETS.includes(p.slice('private-assets/'.length)))

export async function verifyBackup(backupDirectory,{expectedCommit=BASELINE_SHA}={}){
  const dir=await realpath(backupDirectory)
  const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'))
  if(manifest.format!=='LUMIA-LM01-PARTIAL-LOCAL-BACKUP'||
     manifest.commit!==expectedCommit||manifest.source_clean!==true||
     !Array.isArray(manifest.assets))throw Error('INVALID_BACKUP_MANIFEST')
  const list=manifest.assets
  if(list.length<REQUIRED_ASSETS.length||list.some(x=>!validateManifestPath(x.path))||
     new Set(list.map(x=>x.path)).size!==list.length)throw Error('INVALID_BACKUP_ALLOWLIST')
  for(const item of REQUIRED_ASSETS)if(!list.some(a=>a.path===relAsset(item)))throw Error('MISSING_REQUIRED_BACKUP_ASSET')
  for(const item of list){
    const path=join(dir,item.path)
    const meta=await getFileMeta(path,item.path)
    if(item.bytes!==meta.bytes||item.sha256!==meta.sha256)throw Error('BACKUP_HASH_MISMATCH:'+basename(path))
  }
  const bundlePath=join(dir,'lumia-git-HEAD.bundle')
  const bundle=await getFileMeta(bundlePath,'lumia-git-HEAD.bundle')
  if(bundle.bytes!==manifest.code_bundle.bytes||
     bundle.sha256!==manifest.code_bundle.sha256)throw Error('GIT_BUNDLE_HASH_MISMATCH')
  return {
    lab:'LUMIA-MASTER-LM01',mode:'backup_verification',ok:true,
    commit:manifest.commit,assets_verified:list.length,
    required_verified:REQUIRED_ASSETS.length,
    git_bundle_sha256_match:true,
    ollama_weights_backed_up:false,
    external_runtime_backed_up:false,
    original_modified:false,
    is_full_system_backup:false,
  }
}

export async function backupProject(source,dest,{expectedCommit=BASELINE_SHA}={}){
  if(!isAbsolute(dest))throw Error('ABSOLUTE_DESTINATION_REQUIRED')
  const a=await auditProject(source,{expectedCommit,models:true})
  if(!a.expected_commit_match)throw Error('BASELINE_COMMIT_CHANGED_ABORT')
  if(!a.clean_worktree)throw Error('UNCLEAN_SOURCE_WORKTREE_ABORT')
  if(a.required_assets_missing.length)throw Error(
    'MISSING_PRIVATE_ASSETS:'+a.required_assets_missing.join(','))
  if(!Object.values(a.launchers).every(Boolean))throw Error('MISSING_DAILY_LAUNCHER')
  // A destination inside source or an ancestor of it is not an independent backup.
  await mkdir(dest,{recursive:true})
  const target=await realpath(dest)
  if(isContained(a.source,target)||isContained(target,a.source)){
    throw Error('BACKUP_TARGET_MUST_BE_OUTSIDE_SOURCE_TREE')
  }
  const stamp=new Date().toISOString().replace(/[:.]/g,'-')
  const label='LUMIA-ASUS-LM01-'+a.commit.slice(0,7)+'-'+stamp+'-'+randomUUID().slice(0,6)
  const staging=join(target,'.'+label+'.incomplete')
  const final=join(target,label)
  await mkdir(staging,{recursive:false})
  try{
    const included=[...a.private_assets,
      ...a.optional_assets.filter(x=>x.bytes!==null)]
    const files=[]
    for(const item of included){
      const src=join(a.source,item.path)
      const dst=join(staging,relAsset(item.path))
      await mkdir(dirname(dst),{recursive:true})
      await copyFile(src,dst,constants.COPYFILE_EXCL)
      const before=await getFileMeta(src,relAsset(item.path))
      const after=await getFileMeta(dst,relAsset(item.path))
      if(before.sha256!==after.sha256||before.bytes!==after.bytes){
        throw Error('COPY_VERIFY_FAILED:'+basename(item.path))
      }
      files.push(after)
    }
    const bundlePath=join(staging,'lumia-git-HEAD.bundle')
    // Git bundle captures committed source code, not ignored assets/secrets.
    runGit(a.source,['bundle','create',bundlePath,'HEAD'],120000)
    runGit(a.source,['bundle','verify',bundlePath],120000)
    const codeBundle=await getFileMeta(bundlePath,'lumia-git-HEAD.bundle')
    const check=await auditProject(a.source,{expectedCommit,models:false})
    if(check.commit!==a.commit||!check.clean_worktree){
      throw Error('SOURCE_CHANGED_DURING_BACKUP')
    }
    const manifest={
      format:'LUMIA-LM01-PARTIAL-LOCAL-BACKUP',version:1,
      created_at:new Date().toISOString(),commit:a.commit,branch:a.branch,
      source_clean:true,
      assets:files,code_bundle:codeBundle,
      ollama_model_names:a.ollama_model_names,
      included:[
        'git_commit_history_reachable_from_HEAD',
        'one_private_VRM','seventeen_private_Motion_R8_FBX',
        'optional_legacy_GLB_and_BlazeFace_if_present',
      ],
      excluded:[
        'uncommitted_untracked_files','other_private_data','secrets',
        'Ollama_model_weight_blobs','.local-runtime','global_Whisper_Kokoro_installations',
        'Python_virtualenv','node_modules','logs','images','audio','biometric_enrollments',
      ],
      full_system_backup:false,
    }
    await writeFile(join(staging,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{
      encoding:'utf8',flag:'wx',
    })
    await verifyBackup(staging,{expectedCommit})
    await rename(staging,final)
    return {
      lab:'LUMIA-MASTER-LM01',mode:'local_partial_backup',
      ok:true,backup_directory:final,commit:a.commit,
      assets_verified:files.length,
      code_bundle_verified:true,
      original_modified:false,
      private_content_uploaded:false,
      remote_models_backed_up:false,
      local_runtime_backed_up:false,
      full_system_backup:false,
    }
  }catch(error){
    // Keep an incomplete directory for diagnosis rather than call it verified;
    // do not erase any input or unrelated backup.
    throw Error('BACKUP_NOT_COMPLETED:'+String(error?.message||'UNKNOWN'))
  }
}
const arg=(args,name)=>{
  const i=args.indexOf(name)
  return i<0?null:args[i+1]??null
}
async function main(args){
  const modes=['--audit','--backup','--verify'].filter(x=>args.includes(x))
  if(modes.length!==1)throw Error('SELECT_ONE_MODE_AUDIT_BACKUP_VERIFY')
  const source=arg(args,'--source')||
    (process.env.USERPROFILE?join(process.env.USERPROFILE,'LUMIA-ASUS'):null)
  if(modes[0]==='--audit'){
    if(!source)throw Error('SOURCE_REQUIRED')
    console.log(JSON.stringify(publiclySafeAudit(await auditProject(source,{models:true}))))
    return
  }
  if(modes[0]==='--verify'){
    const dir=arg(args,'--backup-dir')
    if(!dir)throw Error('BACKUP_DIR_REQUIRED')
    console.log(JSON.stringify(await verifyBackup(dir)))
    return
  }
  const dest=arg(args,'--dest')
  if(!source||!dest)throw Error('SOURCE_AND_DEST_REQUIRED')
  console.log(JSON.stringify(await backupProject(source,dest)))
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  main(process.argv.slice(2)).catch(err=>{
    const msg=String(err?.message||'UNKNOWN')
    const known=/^(SOURCE_MUST_BE_EXACT_GIT_ROOT|BASELINE_COMMIT_CHANGED_ABORT|UNCLEAN_SOURCE_WORKTREE_ABORT|MISSING_PRIVATE_ASSETS|MISSING_DAILY_LAUNCHER|ABSOLUTE_DESTINATION_REQUIRED|BACKUP_TARGET_MUST_BE_OUTSIDE_SOURCE_TREE|BACKUP_NOT_COMPLETED|BACKUP_DIR_REQUIRED|SOURCE_AND_DEST_REQUIRED|SELECT_ONE_MODE_AUDIT_BACKUP_VERIFY|INVALID_BACKUP_MANIFEST|INVALID_BACKUP_ALLOWLIST|BACKUP_HASH_MISMATCH|MISSING_REQUIRED_BACKUP_ASSET|GIT_BUNDLE_HASH_MISMATCH)/.test(msg)
    console.error('[LUMIA MASTER] '+(known?msg:'LOCAL_AUDIT_OR_BACKUP_ERROR'))
    process.exitCode=1
  })
}
