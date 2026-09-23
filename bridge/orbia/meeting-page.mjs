/**
 * Standalone localhost Meeting Intelligence console.
 *
 * No external scripts/styles. Audio is converted in-browser to mono PCM16 WAV
 * and sent only to the local bridge.
 */

export function renderMeetingPage() {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>L.U.M.I.A. Meeting Intelligence</title>
<style>
  :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
  *{box-sizing:border-box}
  html,body{margin:0;min-height:100%;background:#071014;color:#d8eef2}
  body{height:100vh;overflow:hidden}
  main{width:min(1720px,calc(100vw - 24px));height:100vh;margin:0 auto;padding:14px 0 16px;display:flex;flex-direction:column}
  h1{font-size:22px;margin:0 0 2px}.sub{color:#7ba5ad;margin-bottom:10px;font-size:13px}
  .grid{display:grid;grid-template-columns:minmax(286px,320px) minmax(0,1fr);gap:12px;flex:1;min-height:0}
  .card{background:#0b171c;border:1px solid #17323a;border-radius:14px;padding:14px;min-height:0}
  .control-card{overflow:auto;padding-right:10px}
  .transcript-card{display:flex;flex-direction:column;padding:10px}
  .transcript-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:3px 5px 10px;border-bottom:1px solid #17323a}
  .transcript-title{font-weight:700;color:#cdebf0}.tracking{font-size:11px;color:#7ba5ad;text-align:right}
  label{display:block;color:#8eb5bd;font-size:11px;margin:10px 0 4px}
  input,select,button,textarea{font:inherit}
  input,select,textarea{width:100%;background:#071115;color:#d8eef2;border:1px solid #23434c;border-radius:9px;padding:8px}
  button{background:#14343d;color:#dff7fb;border:1px solid #2b5b67;border-radius:9px;padding:8px 10px;cursor:pointer}
  button:hover{background:#1a424d} button:disabled{opacity:.4;cursor:not-allowed}
  .buttons{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
  .danger{border-color:#8c3434;background:#3a1616}.good{border-color:#2c705b}
  #recording{display:none;background:#3c1111;border:1px solid #8f3434;color:#ffbaba;border-radius:10px;padding:8px 10px;margin-bottom:10px;font-weight:700;font-size:13px}
  #recording.on{display:block}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#ff4949;margin-right:8px}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}
  .stat{background:#081216;border-radius:9px;padding:8px}.stat b{display:block;font-size:16px}.stat span{font-size:10px;color:#769ca4}
  #transcript{flex:1;min-height:0;overflow:auto;background:#071115;border-radius:10px;padding:8px 14px;margin-top:8px}
  .turn{padding:10px 2px;border-bottom:1px solid #10272e}.speaker{font-weight:700;color:#91dae7}.time{font-size:11px;color:#688f97;margin-left:8px}
  .text{margin-top:4px;line-height:1.5;font-size:15px;max-width:1100px}.important{color:#ffd36b;margin-left:6px}
  .empty{height:100%;display:grid;place-items:center;color:#496b72;text-align:center}
  #answer{margin-top:8px;line-height:1.4;color:#c8e5ea;font-size:12px}
  #log{font:11px ui-monospace,monospace;color:#81aab2;white-space:pre-wrap;margin-top:8px}
  @media(max-width:900px){
    body{height:auto;overflow:auto}
    main{height:auto;min-height:100vh;width:min(100% - 16px,900px);padding:10px 0}
    .grid{grid-template-columns:1fr}
    .control-card{overflow:visible}
    #transcript{height:60vh;min-height:420px}
  }
</style>
</head>
<body>
<main>
  <h1>L.U.M.I.A. Meeting Intelligence</h1>
  <div class="sub">Transcripción local · Whisper · diarización · Teams reconciliation</div>
  <div id="recording"><span class="dot"></span>TRANSCRIPCIÓN ACTIVA · informa a los participantes</div>
  <div class="grid">
    <section class="card control-card">
      <label>Título</label>
      <input id="title" value="Reunión">
      <label>Plataforma</label>
      <select id="platform">
        <option value="teams">Microsoft Teams</option>
        <option value="zoom">Zoom</option>
        <option value="meet">Google Meet</option>
        <option value="room">Presencial</option>
        <option value="generic">Otra</option>
      </select>
      <label>Mi nombre en la reunión</label>
      <input id="localName" value="Víctor">
      <label>Participantes esperados <span style="color:#557d85">(opcional)</span></label>
      <input id="expectedParticipants" type="number" min="1" max="20" step="1" placeholder="Ej.: 3">
      <div class="buttons">
        <button id="start" class="good">Iniciar reunión</button>
        <button id="mic" disabled>🎙 Micrófono</button>
        <button id="system" disabled>🔊 Audio sistema</button>
      </div>
      <div class="buttons">
        <button id="pause" disabled>Pausar</button>
        <button id="resume" disabled>Continuar</button>
        <button id="important" disabled>⭐ Marcar esto</button>
        <button id="end" class="danger" disabled>Terminar</button>
      </div>
      <div class="stats">
        <div class="stat"><b id="clock">00:00:00</b><span>duración</span></div>
        <div class="stat"><b id="turnCount">0</b><span>intervenciones</span></div>
        <div class="stat"><b id="speakerCount">0</b><span>speakers</span></div>
      </div>
      <label>Importar transcript Teams (.vtt)</label>
      <input id="vtt" type="file" accept=".vtt,text/vtt" disabled>
      <div class="buttons">
        <button id="analyze" disabled>Generar resumen local</button>
      </div>
      <label>Preguntar sobre esta reunión</label>
      <textarea id="question" rows="3" placeholder="Ej.: ¿Qué dijo Raúl sobre los trackers?" disabled></textarea>
      <div class="buttons">
        <button id="ask" disabled>Preguntar a Lumi</button>
      </div>
      <div id="answer" style="margin-top:10px;line-height:1.45;color:#c8e5ea"></div>
      <div id="log">Preparado.</div>
    </section>
    <section class="card transcript-card">
      <div class="transcript-head">
        <div class="transcript-title">Transcripción en vivo</div>
        <div id="trackingState" class="tracking">MI-02 · esperando reunión presencial</div>
      </div>
      <div id="transcript"><div class="empty">La transcripción aparecerá aquí.</div></div>
    </section>
  </div>
</main>
<script>
(() => {
  const $ = (id) => document.getElementById(id)
  let meetingId = null
  let startedAt = 0
  let paused = false
  let sources = []
  let poll = null
  let timer = null
  let transcript = []
  let speakerTracking = null

  const log = (msg) => { $('log').textContent = msg }
  const elapsed = () => startedAt ? Math.max(0, performance.now() - startedAt) : 0
  const time = (ms) => {
    const s = Math.floor(ms / 1000)
    return [Math.floor(s/3600), Math.floor((s%3600)/60), s%60]
      .map(x => String(x).padStart(2,'0')).join(':')
  }

  async function json(url, options={}) {
    const res = await fetch(url, options)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.message || body.errorCode || ('HTTP ' + res.status))
    return body
  }

  function setActive(on) {
    $('recording').classList.toggle('on', on)
    $('start').disabled = on
    $('mic').disabled = !on
    $('system').disabled = !on
    $('pause').disabled = !on
    $('resume').disabled = true
    $('important').disabled = !on
    $('end').disabled = !on
    $('vtt').disabled = !meetingId
    $('analyze').disabled = !meetingId
    $('question').disabled = !meetingId
    $('ask').disabled = !meetingId
  }

  function render() {
    const speakers = new Set(
      transcript
        .filter(x =>
          x.speakerId ||
          (x.speakerName &&
           String(x.speakerName).toLowerCase() !== 'unknown speaker')
        )
        .map(x => x.speakerId || x.speakerName)
        .filter(Boolean),
    )
    $('turnCount').textContent = String(transcript.length)
    $('speakerCount').textContent = String(speakers.size)
    $('transcript').innerHTML = transcript.length
      ? transcript.map(turn => {
          const safe = (s) => String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
          return '<div class="turn"><div><span class="speaker">' +
            safe(turn.speakerName || 'Unknown speaker') + '</span><span class="time">' +
            time(turn.startedAtMs || 0) + '</span>' +
            (turn.markedImportant ? '<span class="important">★</span>' : '') +
            '</div><div class="text">' + safe(turn.text) + '</div></div>'
        }).join('')
      : '<div class="empty">La transcripción aparecerá aquí.</div>'

    if (speakerTracking) {
      $('trackingState').textContent =
        'MI-04 activo · ' +
        speakerTracking.anonymousSpeakerCount +
        ' voz(es) anónima(s)' +
        (speakerTracking.expectedParticipants
          ? ' · objetivo ' + speakerTracking.expectedParticipants
          : '') +
        (speakerTracking.merges?.length
          ? ' · ' + speakerTracking.merges.length + ' fusión(es)'
          : '') +
        (speakerTracking.shortRecoveryCount
          ? ' · ' + speakerTracking.shortRecoveryCount + ' turno(s) corto(s) recuperado(s)'
          : '') +
        (speakerTracking.primaryProfileAvailable ? ' · perfil local disponible' : '')
    } else {
      $('trackingState').textContent =
        $('platform').value === 'room'
          ? 'MI-04 · esperando audio para identificar voces'
          : 'Identidad por plataforma / diarización de respaldo'
    }

    $('transcript').scrollTop = $('transcript').scrollHeight
  }

  async function refresh() {
    if (!meetingId) return
    try {
      const data = await json('/meeting/' + encodeURIComponent(meetingId) + '/snapshot')
      transcript = data.transcript || []
      speakerTracking = data.speakerTracking || null
      render()
    } catch (e) {
      log('Estado: ' + e.message)
    }
  }

  function resample(input, fromRate, toRate=16000) {
    if (fromRate === toRate) return input
    const length = Math.max(1, Math.round(input.length * toRate / fromRate))
    const out = new Float32Array(length)
    const ratio = fromRate / toRate
    for (let i=0;i<length;i++) {
      const pos = i * ratio
      const lo = Math.floor(pos)
      const hi = Math.min(input.length - 1, lo + 1)
      const t = pos - lo
      out[i] = input[lo] * (1-t) + input[hi] * t
    }
    return out
  }

  function wav16(samples, rate=16000) {
    const ab = new ArrayBuffer(44 + samples.length * 2)
    const v = new DataView(ab)
    const str = (o,s) => { for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)) }
    str(0,'RIFF'); v.setUint32(4,36+samples.length*2,true); str(8,'WAVE')
    str(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true)
    v.setUint16(22,1,true); v.setUint32(24,rate,true); v.setUint32(28,rate*2,true)
    v.setUint16(32,2,true); v.setUint16(34,16,true); str(36,'data')
    v.setUint32(40,samples.length*2,true)
    for(let i=0;i<samples.length;i++) {
      const x = Math.max(-1,Math.min(1,samples[i]))
      v.setInt16(44+i*2, x < 0 ? x*32768 : x*32767, true)
    }
    return new Blob([ab], {type:'audio/wav'})
  }

  function concat(parts, total) {
    const out = new Float32Array(total)
    let at = 0
    for (const p of parts) { out.set(p, at); at += p.length }
    return out
  }

  async function attachAudio(stream, channel) {
    if (!stream.getAudioTracks().length) throw new Error('La fuente no entregó audio.')
    const ctx = new AudioContext()
    await ctx.resume()
    const src = ctx.createMediaStreamSource(stream)
    const node = ctx.createScriptProcessor(4096, 1, 1)
    const silent = ctx.createGain(); silent.gain.value = 0
    src.connect(node); node.connect(silent); silent.connect(ctx.destination)

    let parts = [], total = 0, chunkStart = elapsed(), chain = Promise.resolve()
    const chunkSeconds = $('platform').value === 'room' ? 10 : 8
    const threshold = ctx.sampleRate * chunkSeconds

    const send = (samples, offset) => {
      if (!samples.length || !meetingId) return
      const pcm = resample(samples, ctx.sampleRate)
      const blob = wav16(pcm)
      const q = new URLSearchParams({
        channel,
        offsetMs: String(Math.round(offset)),
        localName: $('localName').value.trim() || 'LOCAL USER',
        expectedParticipants: $('expectedParticipants').value.trim(),
        platform: $('platform').value,
      })
      chain = chain.then(async () => {
        const res = await fetch('/meeting/' + encodeURIComponent(meetingId) + '/audio?' + q, {
          method:'POST', headers:{'content-type':'audio/wav'}, body:blob
        })
        if (!res.ok) {
          const body = await res.json().catch(()=>({}))
          throw new Error(body.message || body.errorCode || 'audio ingest failed')
        }
        await refresh()
      }).catch(e => log(channel + ': ' + e.message))
    }

    const flush = () => {
      if (!total) return
      const data = concat(parts, total)
      const offset = chunkStart
      parts = []; total = 0; chunkStart = elapsed()
      send(data, offset)
    }

    node.onaudioprocess = (event) => {
      if (paused || !meetingId) return
      if (!total) chunkStart = elapsed()
      const data = new Float32Array(event.inputBuffer.getChannelData(0))
      parts.push(data); total += data.length
      if (total >= threshold) flush()
    }

    const handle = {
      channel,
      async stop(flushLast=true) {
        if (flushLast) flush()
        node.onaudioprocess = null
        try{src.disconnect();node.disconnect();silent.disconnect()}catch{}
        for(const t of stream.getTracks()) t.stop()
        await chain
        await ctx.close().catch(()=>{})
      }
    }
    sources.push(handle)
    return handle
  }

  $('start').onclick = async () => {
    try {
      const data = await json('/meeting/start', {
        method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({
          title:$('title').value.trim() || 'Reunión',
          platform:$('platform').value,
          participants:[{id:'local-primary',displayName:$('localName').value.trim() || 'LOCAL USER',isLocalUser:true}]
        })
      })
      meetingId = data.id
      startedAt = performance.now()
      paused = false
      setActive(true)
      timer = setInterval(() => $('clock').textContent = time(elapsed()), 500)
      poll = setInterval(refresh, 2000)
      log('Reunión iniciada: ' + meetingId)
      await refresh()
    } catch(e){ log('No se pudo iniciar: ' + e.message) }
  }

  $('mic').onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}
      })
      await attachAudio(stream,'microphone')
      $('mic').disabled = true
      log('Micrófono activo.')
    } catch(e){ log('Micrófono: ' + e.message) }
  }

  $('system').onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({video:true,audio:true})
      await attachAudio(stream,'system-audio')
      $('system').disabled = true
      log('Audio del sistema activo. Mantén habilitada la opción de compartir audio.')
    } catch(e){ log('Audio del sistema: ' + e.message) }
  }

  $('pause').onclick = async () => {
    try {
      await json('/meeting/' + encodeURIComponent(meetingId) + '/pause',{method:'POST'})
      paused = true; $('pause').disabled = true; $('resume').disabled = false
      log('Transcripción pausada.')
    } catch(e){log(e.message)}
  }

  $('resume').onclick = async () => {
    try {
      await json('/meeting/' + encodeURIComponent(meetingId) + '/resume',{method:'POST'})
      paused = false; $('pause').disabled = false; $('resume').disabled = true
      log('Transcripción reanudada.')
    } catch(e){log(e.message)}
  }

  $('important').onclick = async () => {
    try {
      await json('/meeting/' + encodeURIComponent(meetingId) + '/important',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({atMs:Math.round(elapsed()),note:''})
      })
      log('Momento importante marcado en ' + time(elapsed()) + '.')
    } catch(e){log(e.message)}
  }

  $('end').onclick = async () => {
    try {
      const current = [...sources]; sources = []
      for (const source of current) await source.stop(true)
      await json('/meeting/' + encodeURIComponent(meetingId) + '/end',{method:'POST'})
      clearInterval(poll); clearInterval(timer)
      setActive(false)
      $('vtt').disabled = false; $('analyze').disabled = false
      await refresh()
      log('Reunión terminada. Transcript guardado localmente.')
    } catch(e){log('Fin: ' + e.message)}
  }

  $('vtt').onchange = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !meetingId) return
    try {
      const text = await file.text()
      const res = await fetch('/meeting/' + encodeURIComponent(meetingId) + '/import/teams-vtt',{
        method:'POST',headers:{'content-type':'text/vtt'},body:text
      })
      const data = await res.json().catch(()=>({}))
      if(!res.ok) throw new Error(data.message || 'import failed')
      await refresh()
      log('Teams importado: ' + data.importedTurns + ' intervenciones; nombres reconciliados.')
    } catch(e){log('Teams VTT: ' + e.message)}
  }

  $('ask').onclick = async () => {
    if (!meetingId) return
    const question = $('question').value.trim()
    if (!question) return
    try {
      $('ask').disabled = true
      $('answer').textContent = 'Consultando la transcripción local...'
      const data = await json('/meeting/' + encodeURIComponent(meetingId) + '/query',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({question})
      })
      $('answer').textContent = data.answer || 'No encontré una respuesta respaldada.'
    } catch(e) {
      $('answer').textContent = 'Consulta: ' + e.message
    } finally {
      $('ask').disabled = false
    }
  }

  $('analyze').onclick = async () => {
    try {
      $('analyze').disabled = true
      log('Qwen está generando resumen, decisiones y tareas...')
      const data = await json('/meeting/' + encodeURIComponent(meetingId) + '/analyze',{method:'POST'})
      log('Análisis local generado. Tareas: ' + (data.actionItems?.length || 0) + ', decisiones: ' + (data.decisions?.length || 0))
    } catch(e){log('Análisis: ' + e.message)}
    finally{$('analyze').disabled = false}
  }

  setActive(false)
})()
</script>
</body>
</html>`
}
