#!/usr/bin/env node
/**
 * Regression for VI-04A: actual Vite dev HTTP module requests for MediaPipe's
 * local loader must return original bytes, NOT the public-dir import error.
 * No camera, biometric data, model inference or Internet are involved.
 */
import assert from 'node:assert/strict'
import {copyFileSync,existsSync,mkdirSync,readFileSync,rmSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'

const root=fileURLToPath(new URL('../',import.meta.url))
const target=join(root,'public','mediapipe')
const source=join(root,'node_modules','@mediapipe','tasks-vision','wasm')
const filenames=['vision_wasm_internal.js','vision_wasm_nosimd_internal.js']
const added=[]
let server
try{
  assert.ok(existsSync(join(source,filenames[0])),'npm ci must install MediaPipe WASM')
  mkdirSync(target,{recursive:true})
  for(const name of filenames){
    if(!existsSync(join(source,name)))continue
    const local=join(target,name)
    if(!existsSync(local)){copyFileSync(join(source,name),local);added.push(local)}
  }
  server=await createServer({
    configFile:resolve(root,'vite.config.ts'),
    logLevel:'silent',
    server:{host:'127.0.0.1',port:0,strictPort:false},
  })
  await server.listen()
  const address=server.httpServer?.address()
  assert.ok(address&&typeof address!=='string')
  for(const name of filenames){
    const local=join(target,name)
    if(!existsSync(local))continue
    const expected=readFileSync(local)
    for(const suffix of ['', '?import']){
      const url=`http://127.0.0.1:${address.port}/mediapipe/${name}${suffix}`
      const response=await fetch(url,{signal:AbortSignal.timeout(15_000)})
      assert.equal(response.status,200,`GET ${name}${suffix}`)
      assert.match(response.headers.get('content-type')??'',/javascript/)
      const actual=Buffer.from(await response.arrayBuffer())
      assert.ok(actual.equals(expected),`Vite transformed/rejected MediaPipe ${name}${suffix}`)
    }
  }
  console.log('VI-04A WASM ROUTE PASS: raw local MediaPipe loaders served via Vite (plain and ?import)')
}finally{
  if(server)await server.close()
  for(const path of added)rmSync(path,{force:true})
}
