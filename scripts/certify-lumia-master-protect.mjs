#!/usr/bin/env node
/** Synthetic fixture: never touches real LUMIA or external files. */
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtemp,mkdir,readFile,rm,stat,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname,join} from 'node:path'
import {
  auditProject,backupProject,verifyBackup,
  PRIVATE_VRM,MOTION_FILES,REQUIRED_ASSETS,OPTIONAL_ASSETS,
} from './lumia-master-protect.mjs'

const git=(dir,...argv)=>execFileSync('git',argv,{
  cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,
}).trim()

assert.equal(REQUIRED_ASSETS.length,18)
assert.equal(new Set(MOTION_FILES).size,17)
assert.equal(PRIVATE_VRM,'public/models/lumia-motion/LUMIA_VITA_NATURAL_V05.vrm')
const catalogText=await readFile(new URL('../src/scene/lumia-motion-r8/motion-library-catalog.js',import.meta.url),'utf8')
for(const file of MOTION_FILES){
  assert.ok(catalogText.includes('"file": "'+file+'"'),'Clip no coincide con catálogo: '+file)
}
assert.equal(MOTION_FILES.length,(catalogText.match(/"file":/g)||[]).length)
const tmp=await mkdtemp(join(tmpdir(),'lumia-master-lm01-test-'))
try{
  const source=join(tmp,'fake-asus')
  const destination=join(tmp,'safe-backups')
  await mkdir(source)
  await mkdir(destination)
  git(source,'init','-q')
  git(source,'config','user.name','Lumia QA synthetic')
  git(source,'config','user.email','lumia-qa@example.invalid')
  const tracked={
    'README.md':'synthetic test content',
    'INICIAR_LUMIA_ASUS_RAPIDA.cmd':'mock source no executable',
    'INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd':'mock source no executable',
    '.gitignore':[
      'public/models/lumia-motion/*.vrm',
      'public/models/lumia-motion/clips/',
      'public/models/lumia/lumia.glb',
      'public/models/vision/*.tflite',
    ].join('\n')+'\n',
  }
  for(const [name,text] of Object.entries(tracked)){
    await writeFile(join(source,name),text)
  }
  git(source,'add','.')
  git(source,'commit','-qm','synthetic fixed baseline')
  const sha=git(source,'rev-parse','HEAD')

  const first=await auditProject(source,{expectedCommit:sha})
  assert.equal(first.required_assets_present,0)
  assert.equal(first.required_assets_missing.length,18)
  assert.equal(first.clean_worktree,true)
  assert.equal(first.expected_commit_match,true)
  await assert.rejects(
    backupProject(source,destination,{expectedCommit:sha}),
    /MISSING_PRIVATE_ASSETS/,
  )

  for(const [i,name] of REQUIRED_ASSETS.entries()){
    const file=join(source,name)
    await mkdir(dirname(file),{recursive:true})
    await writeFile(file,Buffer.from('SYNTHETIC ASSET '+i+' verified'))
  }
  const option=join(source,OPTIONAL_ASSETS[0])
  await mkdir(dirname(option),{recursive:true})
  await writeFile(option,'synthetic legacy fallback only')
  const ready=await auditProject(source,{expectedCommit:sha})
  assert.equal(ready.required_assets_present,18)
  assert.equal(ready.clean_worktree,true)
  assert.equal(ready.optional_assets_present.length,1)
  await assert.rejects(
    backupProject(source,join(source,'inside-dir'),{expectedCommit:sha}),
    /BACKUP_TARGET_MUST_BE_OUTSIDE_SOURCE_TREE/,
  )
  await assert.rejects(
    backupProject(source,join(tmp,'nonexistent-target'),{expectedCommit:sha}),
    /BACKUP_DESTINATION_MUST_ALREADY_EXIST/,
  )
  await assert.rejects(
    backupProject(source,destination,{expectedCommit:'f'.repeat(40)}),
    /BASELINE_COMMIT_CHANGED_ABORT/,
  )
  const result=await backupProject(source,destination,{expectedCommit:sha})
  assert.equal(result.ok,true)
  assert.equal(result.assets_verified,19)
  assert.equal(result.code_bundle_verified,true)
  assert.equal(result.original_modified,false)
  assert.equal(result.full_system_backup,false)
  assert.equal(result.private_content_uploaded,false)
  const manifest=JSON.parse(await readFile(join(result.backup_directory,'manifest.json'),'utf8'))
  assert.equal(manifest.commit,sha)
  assert.equal(manifest.assets.length,19)
  assert.equal(manifest.full_system_backup,false)
  assert.ok(manifest.excluded.includes('Ollama_model_weight_blobs'))
  assert.ok((await stat(join(result.backup_directory,'lumia-git-HEAD.bundle'))).size>0)
  // Prove the Git bundle is genuinely RESTORABLE, not merely checksum-valid.
  const restored=join(tmp,'restored-from-bundle')
  execFileSync('git',[
    'clone','-q',join(result.backup_directory,'lumia-git-HEAD.bundle'),restored,
  ],{cwd:tmp,encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']})
  assert.equal(git(restored,'rev-parse','HEAD'),sha)
  assert.equal(await readFile(join(restored,'README.md'),'utf8'),'synthetic test content')
  const verified=await verifyBackup(result.backup_directory,{expectedCommit:sha})
  assert.equal(verified.ok,true)
  assert.equal(verified.assets_verified,19)
  assert.equal(verified.required_verified,18)
  assert.equal(verified.is_full_system_backup,false)
  assert.equal(git(source,'rev-parse','HEAD'),sha)
  assert.equal(git(source,'status','--porcelain'),'')

  // Tamper with backup copy, not the source. Verification must fail.
  await writeFile(join(result.backup_directory,'private-assets',PRIVATE_VRM),'tampered')
  await assert.rejects(
    verifyBackup(result.backup_directory,{expectedCommit:sha}),
    /BACKUP_HASH_MISMATCH/,
  )
  await writeFile(join(source,'README.md'),'uncommitted change')
  await assert.rejects(
    backupProject(source,destination,{expectedCommit:sha}),
    /UNCLEAN_SOURCE_WORKTREE_ABORT/,
  )
  console.log('LUMIA MASTER LM-01 PASS: 18 VRM/FBX, RESTORED git bundle, SHA256 verify, no overwrite, refuses missing/dirty/in-tree, original intact')
}finally{
  await rm(tmp,{recursive:true,force:true})
}
