/**
 * Explicit owner-run VI-04 model installation (also called by VI-04 launcher).
 * Downloads ONLY the public BlazeFace task weights, never user images.
 * Model stays at /models/vision/... for subsequent offline sessions.
 */
import {mkdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'

const MODEL_URL='https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'
const TARGET=resolve('public/models/vision/blaze_face_short_range.tflite')
const MIN_BYTES=40_000
const MAX_BYTES=4_000_000

async function main():Promise<void>{
  try{
    const current=await stat(TARGET)
    if(current.isFile() && current.size>=MIN_BYTES && current.size<=MAX_BYTES){
      console.log('[LUMIA VI-04] Modelo BlazeFace local encontrado; sin descarga.')
      return
    }
  }catch{ /* first run */ }

  console.log('[LUMIA VI-04] Descargando una vez el modelo oficial BlazeFace (solo pesos, NO fotos).')
  const response=await fetch(MODEL_URL,{signal:AbortSignal.timeout(45_000)})
  if(!response.ok)throw new Error('Servidor de modelo respondió HTTP '+response.status)
  const length=Number(response.headers.get('content-length')||0)
  if(length>MAX_BYTES)throw new Error('Modelo supera el límite esperado.')
  const data=new Uint8Array(await response.arrayBuffer())
  if(data.length<MIN_BYTES||data.length>MAX_BYTES)throw new Error('Archivo del modelo fuera de tamaño permitido.')
  // TFLite flatbuffers normally carry the ASCII TFL3 identifier at bytes 4-7.
  if(String.fromCharCode(...data.slice(4,8))!=='TFL3')throw new Error('El archivo recibido no es un modelo TFLite.')
  await mkdir(dirname(TARGET),{recursive:true})
  const temp=TARGET+'.partial-'+process.pid
  try{
    await writeFile(temp,data,{flag:'wx'})
    await rename(temp,TARGET)
  }catch(err){
    await rm(temp,{force:true}).catch(()=>{})
    throw err
  }
  const verify=await readFile(TARGET)
  if(verify.length!==data.length)throw new Error('La copia local del modelo quedó incompleta.')
  console.log('[LUMIA VI-04] Modelo de rostros listo para uso local en CPU.')
}
main().catch(err=>{
  console.error('[LUMIA VI-04] No se instaló el modelo facial:',err instanceof Error?err.message:String(err))
  process.exitCode=1
})
