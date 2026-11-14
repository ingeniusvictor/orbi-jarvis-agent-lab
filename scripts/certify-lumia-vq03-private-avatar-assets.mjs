import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,dirname} from 'node:path'
import {readFileSync} from 'node:fs'
import {
  ASSETS,AVATAR_VRM_REL,inspectAvatarAssets,prepareAvatarAssets,
} from './lumia-private-avatar-assets-vq03.mjs'

assert.equal(ASSETS.length,18)
assert.equal(new Set(ASSETS).size,18)
assert.equal(AVATAR_VRM_REL,'public/models/lumia-motion/LUMIA_VITA_NATURAL_V05.vrm')

const sandbox=await mkdtemp(join(tmpdir(),'lumia-vq03-private-'))
try{
  const original=join(sandbox,'original')
  const qa=join(sandbox,'qa')
  await mkdir(original,{recursive:true})
  await mkdir(qa,{recursive:true})
  await writeFile(join(original,'INICIAR_LUMIA_ASUS_RAPIDA.cmd'),'mock launcher only')
  await writeFile(join(qa,'INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd'),'mock launcher only')
  for(const [i,rel] of ASSETS.entries()){
    const path=join(original,rel)
    await mkdir(dirname(path),{recursive:true})
    await writeFile(path,Buffer.from('synthetic private fixture '+i))
  }
  assert.deepEqual((await inspectAvatarAssets(qa)).presentCount,0)
  const initial=await prepareAvatarAssets(original,qa)
  assert.equal(initial.copied,18)
  assert.equal(initial.verified,true)
  assert.equal((await inspectAvatarAssets(qa)).missing.length,0)
  const repeat=await prepareAvatarAssets(original,qa)
  assert.equal(repeat.copied,0)
  assert.equal(repeat.alreadyPresent,18)
  const originalVrm=join(original,AVATAR_VRM_REL)
  const qaVrm=join(qa,AVATAR_VRM_REL)
  assert.deepEqual(await readFile(originalVrm),await readFile(qaVrm))
  const before=(await stat(qaVrm)).size
  await writeFile(qaVrm,'wrong data')
  await assert.rejects(
    prepareAvatarAssets(original,qa),
    /DESTINATION_DIFFERENT_ASSET:LUMIA_VITA_NATURAL_V05.vrm/,
  )
  assert.equal((await readFile(qaVrm)).toString(),'wrong data')
  assert.ok(before>0)

  await rm(qaVrm)
  await rm(join(original,ASSETS[17]))
  await assert.rejects(
    prepareAvatarAssets(original,qa),
    /SOURCE_MISSING_PRIVATE_ASSETS:/,
  )
  assert.equal((await inspectAvatarAssets(qa)).presentCount,17)
  // The production/base launcher is untouched, there is no upload route.
  const launcher=readFileSync(
    new URL('../INICIAR_LUMIA_ASUS_VQ03_VRM_QA.cmd',import.meta.url),
    'utf8',
  )
  assert.match(launcher,/lumia-private-avatar-assets-vq03\.mjs" --require/)
  assert.ok(launcher.indexOf('--require')<launcher.indexOf('INICIAR_LUMIA_ASUS_2B_DIARIA_AMR030.cmd'))
  assert.doesNotMatch(launcher,/git (?:reset|checkout|clean)|ollama (?:rm|pull)/i)
  const ignore=readFileSync(new URL('../.gitignore',import.meta.url),'utf8')
  assert.match(ignore,/public\/models\/lumia-motion\/\*\.vrm/)
  assert.match(ignore,/public\/models\/lumia-motion\/clips\//)
  console.log('VQ-03 ASSETS PASS: 18 ignored private VRM/FBX, no overwrite, verified local-only copy, launcher fail-closed')
}finally{
  await rm(sandbox,{recursive:true,force:true})
}
