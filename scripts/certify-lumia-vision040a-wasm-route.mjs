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
const filenames=['vision_wasm_internal.js','vision_wasm_nosimd_internal.js','vision_wasm_module_internal.js']
const added=[]
let server
try{
  assert.ok(existsSync(join(source,filenames[0])),'npm ci must install MediaPipe WASM')
  assert.ok(existsSync(join(source,'vision_wasm_module_internal.js')),
    'The pinned @mediapipe/tasks-vision must contain native ESM WASM glue')
  assert.ok(existsSync(join(source,'vision_wasm_module_internal.wasm')),
    'The pinned @mediapipe/tasks-vision must contain matching native ESM WASM binary')
  mkdirSync(target,{recursive:true})
  for(const name of [...filenames,'vision_wasm_module_internal.wasm']){
    if(!existsSync(join(source,name)))continue
    const local=join(target,name)
    if(!existsSync(local)){copyFileSync(join(source,name),local);added.push(local)}
  }
  // The bundle must request the ES-module fileset from its module Web Worker;
  // a plain/classic fileset silently recreates "ModuleFactory not set".
  const worker=readFileSync(join(root,'src','lib','vision-face-worker-vi04.ts'),'utf8')
  assert.match(worker,/FilesetResolver\\.forVisionTasks\\('\/mediapipe',true\\)/)
  assert.match(readFileSync(join(root,'scripts','start.mjs'),'utf8'),
    /vision_wasm_module_internal\\.wasm/)
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
  const wasmFile='vision_wasm_module_internal.wasm'
  const wasmResponse=await fetch(`http://127.0.0.1:${address.port}/mediapipe/${wasmFile}`,{
    signal:AbortSignal.timeout(15_000),
  })
  // It is not copied above: duplicate the test into the transient local vendor dir.
  assert.equal(wasmResponse.status,200,`GET ${wasmFile}`)
  const wasmBytes=Buffer.from(await wasmResponse.arrayBuffer())
  assert.ok(wasmBytes.length>1000)
  assert.ok(wasmBytes.subarray(0,4).equals(Buffer.from([0,97,115,109])))
  console.log('VI-04A WASM ROUTE PASS: ESM module glue and WASM are reachable through Vite')
}finally{
  if(server)await server.close()
  for(const path of added)rmSync(path,{force:true})
}
