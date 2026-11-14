import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {createReadStream,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import type {Plugin} from 'vite'

// MediaPipe's WASM loader is dynamically imported by the bundled task library.
// Vite 8 rejects imports of JavaScript under /public unless they are served
// raw, even though direct static GETs work. Intercept only the three known
// loader scripts, before Vite's transform middleware; never expose arbitrary
// files or bypass transforms for the rest of the app.
const mediaPipeRoot=fileURLToPath(new URL('./public/mediapipe/',import.meta.url))
const rawLoaderNames=new Set([
  'vision_wasm_internal.js',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_module_internal.js',
])
const rawMediaPipeWasmLoader=():Plugin=>({
  name:'lumia-mediapipe-raw-wasm-loader',
  enforce:'pre',
  configureServer(server){
    server.middlewares.use((req,res,next)=>{
      if(req.method!=='GET'&&req.method!=='HEAD')return next()
      const pathname=(req.url??'').split('?',1)[0]
      if(!pathname.startsWith('/mediapipe/'))return next()
      const filename=pathname.slice('/mediapipe/'.length)
      if(!rawLoaderNames.has(filename))return next()
      const filepath=resolve(mediaPipeRoot,filename)
      if(!existsSync(filepath))return next()
      res.statusCode=200
      res.setHeader('Content-Type','text/javascript; charset=utf-8')
      res.setHeader('Cache-Control','no-store')
      if(req.method==='HEAD'){res.end();return}
      const stream=createReadStream(filepath)
      stream.on('error',()=>{
        if(!res.headersSent){res.statusCode=500;res.end('MediaPipe loader unavailable')}
        else res.destroy()
      })
      stream.pipe(res)
    })
  },
})


// https://vite.dev/config/
export default defineConfig({
  plugins: [rawMediaPipeWasmLoader(), react()],
  server: {
    // Honour PORT so a second instance can run alongside the first. The bridge
    // only accepts sockets from localhost:5173-5199, so stay inside that range
    // or set JARVIS_ALLOWED_ORIGINS to match.
    port: Number(process.env.PORT) || 5173,
  },
  optimizeDeps: {
    // kokoro-js pulls in `phonemizer`, which carries espeak-ng as inline WASM.
    // Vite's dependency pre-bundler rewrites that initialisation and the
    // language table ends up empty — the symptom is
    // `Invalid language identifier: "en". Should be one of: .` at generate()
    // time, long after the model has loaded successfully. Serving these
    // untouched fixes it.
    exclude: ['kokoro-js', 'phonemizer', '@huggingface/transformers'],
  },
})
