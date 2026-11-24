/** Test actual copy using temporary fake assets only. No private files, GPU, webcam or network. */
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {ASSETS,prepareAvatarAssets,inspectAvatarAssets} from './lumia-private-avatar-assets-rc01.mjs'

const root=await mkdtemp(join(tmpdir(),'lumia-rc01-asset-test-'))
const original=join(root,'ASUS-original')
const qa=join(root,'RC01-QA')
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
try{
  await mkdir(original)
  await mkdir(qa)
  await writeFile(join(original,'INICIAR_LUMIA_ASUS_RAPIDA.cmd'),'original')
  await writeFile(join(qa,'INICIAR_LUMIA_VISION_RC01_ASUS.cmd'),'rc01')
  for(const [idx,rel] of ASSETS.entries()){
    const path=join(original,rel)
    await mkdir(dirname(path),{recursive:true})
    await writeFile(path,'FAKE_TEST_CONTENT_'+String(idx)+'_'+rel)
  }
  assert.equal((await inspectAvatarAssets(original)).presentCount,18)
  assert.equal((await inspectAvatarAssets(qa)).presentCount,0)

  const result=await prepareAvatarAssets(original,qa)
  assert.equal(result.copied,18)
  assert.equal(result.alreadyPresent,0)
  assert.equal(result.verified,true)
  assert.equal((await inspectAvatarAssets(qa)).presentCount,18)

  for(const rel of ASSETS){
    const a=await readFile(join(original,rel))
    const b=await readFile(join(qa,rel))
    assert.equal(hash(a),hash(b),'Asset SHA256 differs '+rel)
  }

  const again=await prepareAvatarAssets(original,qa)
  assert.equal(again.copied,0)
  assert.equal(again.alreadyPresent,18)

  await assert.rejects(prepareAvatarAssets(original,original),/SOURCE_EQUALS_TARGET/)

  const wrong=join(root,'other-target')
  await mkdir(wrong)
  await assert.rejects(prepareAvatarAssets(original,wrong),/DESTINATION_NOT_RC01_WORKTREE/)

  const nested=join(original,'nested-qa')
  await mkdir(nested)
  await writeFile(join(nested,'INICIAR_LUMIA_VISION_RC01_ASUS.cmd'),'rc01')
  await assert.rejects(prepareAvatarAssets(original,nested),/DESTINATION_INSIDE_SOURCE_NOT_ALLOWED/)

  // Fail before copying any other asset if a destination file was edited.
  await writeFile(join(qa,ASSETS[0]),'DIFFERENT_FAKE_ASSET')
  await assert.rejects(prepareAvatarAssets(original,qa),/DESTINATION_DIFFERENT_ASSET:/)
  console.log('LUMIA RC01 PRIVATE ASSET COPY PASS: 18 fake files, SHA256 parity, rerun idempotence, no overwrite, no original modification')
}finally{
  await rm(root,{recursive:true,force:true})
}
