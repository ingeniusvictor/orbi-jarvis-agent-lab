/**
 * Standalone localhost enrollment UI for VG-02.
 * No recording is written to disk by this page.
 */

export function renderSpeakerEnrollmentPage() {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>L.U.M.I.A. · Enrolamiento de voz</title>
<style>
body{font-family:system-ui;background:#071116;color:#d7f4f4;margin:0;padding:32px}
main{max-width:720px;margin:auto}
.card{border:1px solid #285766;border-radius:18px;padding:24px;background:#0b1820}
button{font:inherit;padding:12px 18px;border-radius:12px;border:1px solid #4aa7b6;background:#102a35;color:#e7ffff;cursor:pointer;margin:6px}
button:disabled{opacity:.45;cursor:not-allowed}
#status{white-space:pre-wrap;color:#9ed9df;margin-top:18px}
small{color:#82aeb6}
</style>
</head>
<body>
<main>
<div class="card">
<h1>L.U.M.I.A. · VG-02</h1>
<p>Enrolamiento local del hablante principal. Graba tres muestras de voz natural de unos 4 segundos.</p>
<p><small>Los audios se procesan localmente y no se guardan. Solo se conserva un embedding cifrado con Windows DPAPI.</small></p>
<button id="record">Grabar muestra 1</button>
<button id="verify" disabled>Probar mi voz</button>
<div id="status">Listo para la primera muestra.</div>
</div>
</main>
<script>
const recordButton=document.querySelector('#record')
const verifyButton=document.querySelector('#verify')
const status=document.querySelector('#status')
let count=0

async function captureWav(){
  const stream=await navigator.mediaDevices.getUserMedia({audio:true})
  const recorder=new MediaRecorder(stream)
  const chunks=[]
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
  const stopped=new Promise(resolve=>recorder.onstop=resolve)
  recorder.start()
  status.textContent='Grabando… habla de forma natural.'
  await new Promise(r=>setTimeout(r,4000))
  recorder.stop()
  await stopped
  stream.getTracks().forEach(t=>t.stop())

  const blob=new Blob(chunks,{type:recorder.mimeType})
  const encoded=await blob.arrayBuffer()
  const ctx=new AudioContext()
  const decoded=await ctx.decodeAudioData(encoded.slice(0))
  const channels=decoded.numberOfChannels
  const mono=new Float32Array(decoded.length)
  for(let c=0;c<channels;c++){
    const data=decoded.getChannelData(c)
    for(let i=0;i<data.length;i++)mono[i]+=data[i]/channels
  }
  await ctx.close()

  const targetRate=16000
  const ratio=decoded.sampleRate/targetRate
  const output=new Float32Array(Math.max(1,Math.floor(mono.length/ratio)))
  for(let i=0;i<output.length;i++){
    const pos=i*ratio
    const left=Math.floor(pos)
    const right=Math.min(mono.length-1,left+1)
    const frac=pos-left
    output[i]=mono[left]*(1-frac)+mono[right]*frac
  }

  const wav=new ArrayBuffer(44+output.length*2)
  const view=new DataView(wav)
  const write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))}
  write(0,'RIFF'); view.setUint32(4,36+output.length*2,true); write(8,'WAVE')
  write(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true)
  view.setUint16(22,1,true); view.setUint32(24,targetRate,true)
  view.setUint32(28,targetRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true)
  write(36,'data'); view.setUint32(40,output.length*2,true)
  for(let i=0;i<output.length;i++){
    const s=Math.max(-1,Math.min(1,output[i]))
    view.setInt16(44+i*2,s<0?s*0x8000:s*0x7fff,true)
  }
  return wav
}

async function postWav(path,wav){
  const response=await fetch(path,{
    method:'POST',
    headers:{'content-type':'audio/wav'},
    body:wav
  })
  const body=await response.json()
  if(!response.ok)throw new Error(body.message||body.errorCode||'request failed')
  return body
}

recordButton.onclick=async()=>{
  recordButton.disabled=true
  verifyButton.disabled=true
  try{
    const wav=await captureWav()
    const result=await postWav('/voice/speaker/enroll/sample',wav)
    count=result.sampleCount
    if(result.enrolled){
      status.textContent='Perfil creado y cifrado localmente. Ya puedes probar tu voz.'
      recordButton.textContent='Reiniciar enrolamiento'
      verifyButton.disabled=false
    }else{
      status.textContent='Muestra '+count+' aceptada. Faltan '+(3-count)+'.'
      recordButton.textContent='Grabar muestra '+(count+1)
    }
  }catch(err){
    status.textContent='Error: '+err.message
  }finally{
    recordButton.disabled=false
    if(count>=3)verifyButton.disabled=false
  }
}

verifyButton.onclick=async()=>{
  verifyButton.disabled=true
  try{
    const wav=await captureWav()
    const result=await postWav('/voice/speaker/verify',wav)
    status.textContent='Coincidencia: '+(result.authorized?'AUTORIZADA':'NO AUTORIZADA')+
      '\nScore: '+Number(result.score).toFixed(3)+
      ' · umbral provisional: '+Number(result.threshold).toFixed(2)
  }catch(err){
    status.textContent='Error: '+err.message
  }finally{
    verifyButton.disabled=false
  }
}
</script>
</body>
</html>`
}
