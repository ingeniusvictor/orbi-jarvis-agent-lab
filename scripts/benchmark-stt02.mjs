/**
 * STT-02 local comparison. Models must already be installed by the owner.
 * No downloads, no network, no input WAV/transcript copied into Git.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { localVoicePaths } from '../bridge/orbia/local-voice-probe.mjs'
import { wordErrorRate } from '../bridge/orbia/stt02-accuracy.mjs'

const exec = promisify(execFile)
const args = process.argv.slice(2)
function arg(name) {
  const i = args.indexOf(name)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null
}
if (args.includes('--help') || !arg('--wav') || !arg('--reference-file')) {
  console.log('STT-02: --wav prueba_16k_mono.wav --reference-file esperado.txt [--moonshine-file resultado.txt]')
  console.log('Whisper Base/Small se ejecutan localmente; Moonshine puede importarse como texto.')
  if (!args.includes('--help')) process.exitCode = 2
} else {
  const wav = resolve(arg('--wav')), refFile = resolve(arg('--reference-file'))
  if (!existsSync(wav) || !existsSync(refFile)) throw new Error('Faltan WAV o referencia.')
  const reference = (await readFile(refFile, 'utf8')).trim()
  if (!reference || reference.length > 20000) throw new Error('Referencia inválida.')
  const { whisperCommand, whisperModel } = localVoicePaths()
  const root = resolve('.local-runtime', 'whisper.cpp', 'models')
  const base = existsSync(join(root, 'ggml-base.bin')) ? join(root,'ggml-base.bin')
    : whisperModel.endsWith('ggml-base.bin') ? whisperModel : join(root, 'ggml-base.bin')
  const small = join(dirname(base),'ggml-small.bin')
  const rows = []
  async function evaluate(name, model) {
    if (!existsSync(whisperCommand) || !existsSync(model)) {
      rows.push({name, status: 'NO INSTALADO'}); return
    }
    const temp = await mkdtemp(join(tmpdir(), 'lumia-stt02-'))
    try {
      const prefix = join(temp,'result'), start = performance.now()
      await exec(whisperCommand, ['-m',model,'-f',wav,'-l','es','-nt','-otxt','-of',prefix],
        {timeout:90000,windowsHide:true,maxBuffer:128*1024})
      const latencyMs = Math.round(performance.now()-start)
      const recognized = (await readFile(prefix+'.txt','utf8')).trim()
      rows.push({name,status:'OK',latencyMs,...wordErrorRate(reference,recognized)})
    } catch (error) {
      rows.push({name,status:'ERROR',reason:String(error?.code ?? 'local')})
    } finally { await rm(temp,{recursive:true,force:true}) }
  }
  await evaluate('Whisper Base',base)
  await evaluate('Whisper Small',small)
  if(arg('--moonshine-file')) {
    const recognized=await readFile(resolve(arg('--moonshine-file')),'utf8')
    rows.push({name:'Moonshine español',status:'TRANSCRIPCIÓN EXTERNA',latencyMs:null,
      ...wordErrorRate(reference,recognized)})
  }
  console.log('STT-02 · WER menor = mejor precisión de palabras')
  for(const r of rows) {
    const metric = r.wer == null ? '' :
      ' WER '+(100*r.wer).toFixed(1)+'% · '+r.errors+'/'+r.referenceWords+' errores · '+(r.latencyMs??'sin tiempo')+' ms'
    console.log(r.name+': '+r.status+metric)
  }
  console.log('Los modelos activos de LUMIA no se modificaron. No se guardaron muestras.')
}
