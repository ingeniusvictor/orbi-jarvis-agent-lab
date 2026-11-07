/**
 * VISION-02.1 — transparent in-app optical viewfinder.
 *
 * "EN VIVO" means only a local alignment preview. It never sends frames to
 * Ollama and does not record video. The preview and JPEG encoder share the
 * exact same unmirrored HTMLVideoElement so what the owner sees is what
 * LUMIA receives when "Capturar y analizar" is explicitly pressed.
 *
 * A one-shot voice capture displays the same encoded JPEG, labeled as frozen,
 * without pretending to show a continuous camera feed afterwards.
 */
import {useEffect,useRef,useState} from 'react'
import * as camera from '../lib/camera'
import {prepareVisualCameraFrame,type LocalVisualImage} from '../lib/visual-input'
import {inspectCameraSignal,connectedOrVirtualCameraHint} from '../lib/vision-camera-signal-vi022'
import type {VisionReplyMode} from '../lib/vision-context-vi023'

type Props={
  live:boolean
  still:LocalVisualImage|null
  onCaptured:(image:LocalVisualImage)=>void
  onClose:()=>void
  onReopen:()=>void
  visualContextReady:boolean
  visualReplyMode:VisionReplyMode
  onVisualReplyModeChange:(mode:VisionReplyMode)=>void
  onAskAboutStill:(question:string)=>void
}

export function LumiaCameraViewfinder({
  live,still,onCaptured,onClose,onReopen,
  visualContextReady,visualReplyMode,onVisualReplyModeChange,onAskAboutStill,
}:Props){
  const videoRef=useRef<HTMLVideoElement>(null)
  const releaseRef=useRef<(()=>void)|null>(null)
  const closeRef=useRef(onClose)
  closeRef.current=onClose
  const [ready,setReady]=useState(false)
  const [error,setError]=useState('')
  const [devices,setDevices]=useState<Array<{deviceId:string;label:string}>>([])
  const [deviceChoice,setDeviceChoice]=useState(camera.getPreferredCameraDeviceId()??'')
  const [activeSource,setActiveSource]=useState(
    camera.getLastCameraSource()?.label??'')
  const [signalWarning,setSignalWarning]=useState<string|null>(null)
  const [followupDraft,setFollowupDraft]=useState('')

  useEffect(()=>{
    if(!live)return
    let cancelled=false
    let held=false
    let source:MediaStream|null=null
    let inspectionTimer:ReturnType<typeof setTimeout>|null=null
    const video=videoRef.current
    const release=()=>{
      if(video && video.srcObject===source){
        video.pause()
        video.srcObject=null
      }
      if(held){
        held=false
        camera.releaseCamera()
      }
    }
    releaseRef.current=release
    setReady(false)
    setError('')
    setSignalWarning(null)
    void (async()=>{
      // Changing a source never interrupts another owner of this shared
      // webcam. The old viewfinder lease is released by effect cleanup.
      camera.setPreferredCameraDeviceId(deviceChoice||null)
      await camera.holdCamera()
      held=true
      if(cancelled){release();return}
      source=camera.cameraStream()
      if(!source || !video)throw new Error('No pude mostrar el flujo de la cámara.')
      // No CSS transform/mirror; the frame shown and the JPEG encode share
      // the same coordinates, including correctly oriented text labels.
      video.srcObject=source
      await video.play()
      if(cancelled){release();return}
      setActiveSource(camera.getCurrentCameraSource()?.label??'Cámara sin nombre')
      setReady(true)
      try{
        const detected=await camera.listCameraDevices()
        if(!cancelled)setDevices(detected)
      }catch{
        // A working preview is useful even when enumeration is unavailable.
      }
      inspectionTimer=setTimeout(()=>{
        if(cancelled || !video)return
        const lowSignal=inspectCameraSignal(video)
        const virtualHint=connectedOrVirtualCameraHint(
          camera.getCurrentCameraSource()?.label??'')
        setSignalWarning(lowSignal??virtualHint)
      },850)
    })().catch((err:unknown)=>{
      release()
      if(!cancelled){
        setReady(false)
        setError(err instanceof Error?err.message:'No se pudo iniciar la cámara.')
      }
    })
    // A preview is temporary and must never silently become an always-on
    // webcam. Closing the panel also discards the camera's lease.
    const expiry=window.setTimeout(()=>{if(!cancelled)closeRef.current()},90_000)
    return ()=>{
      cancelled=true
      window.clearTimeout(expiry)
      if(inspectionTimer)clearTimeout(inspectionTimer)
      release()
      if(releaseRef.current===release)releaseRef.current=null
    }
  },[live,deviceChoice])

  const close=()=>{
    releaseRef.current?.()
    onClose()
  }
  const capture=()=>{
    const video=videoRef.current
    if(!ready || !video)return
    try{
      const image=prepareVisualCameraFrame(video)
      releaseRef.current?.() // release BEFORE Ollama starts, not in a later effect
      setReady(false)
      setError('')
      onCaptured(image)
    }catch(err){
      setError(err instanceof Error?err.message:'No pude capturar esta imagen.')
    }
  }

  return (
    <aside className="lumia-camera-viewfinder" role="region"
      aria-label="Visor de cámara de LUMIA">
      <header className="lumia-camera-viewfinder-head">
        <span className="lumia-camera-viewfinder-title">LUMIA VISION</span>
        <span className={'lumia-camera-viewfinder-status'+(live?' is-live':' is-still')}>
          <span className="lumia-camera-viewfinder-dot" aria-hidden="true"/>
          {live?'EN VIVO · SIN ANALIZAR':'FOTOGRAMA CAPTURADO'}
        </span>
        <button type="button" className="lumia-camera-viewfinder-close"
          aria-label="Cerrar visor y liberar cámara" title="Cerrar cámara"
          onClick={close}>×</button>
      </header>
      <div className="lumia-camera-source">
        {live ? (
          <>
            <label htmlFor="lumia-camera-device">CÁMARA</label>
            <select id="lumia-camera-device"
              aria-label="Seleccionar cámara de LUMIA"
              title="Cambiar entre webcam integrada, cámaras USB y cámaras virtuales"
              value={deviceChoice}
              disabled={!ready&&!error}
              onChange={(event)=>{
                setReady(false)
                setDeviceChoice(event.target.value)
              }}>
              <option value="">Predeterminada de Windows</option>
              {devices.map(device=>(
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <span className="lumia-camera-source-active" role="status">
          Origen usado: {activeSource||'sin identificar'}
        </span>
      </div>
      <div className="lumia-camera-reply-selector" role="group"
        aria-label="Extensión de respuestas visuales">
        <span>RESPUESTA VISUAL</span>
        <button type="button"
          className={visualReplyMode==='breve'?'is-selected':''}
          aria-pressed={visualReplyMode==='breve'}
          onClick={()=>onVisualReplyModeChange('breve')}>Breve</button>
        <button type="button"
          className={visualReplyMode==='detallada'?'is-selected':''}
          aria-pressed={visualReplyMode==='detallada'}
          onClick={()=>onVisualReplyModeChange('detallada')}>Detallada</button>
      </div>
      <div className="lumia-camera-viewfinder-viewport">
        {live ? (
          <video ref={videoRef} className="lumia-camera-viewfinder-video"
            muted playsInline autoPlay aria-label="Vista real de la webcam, sin espejo"/>
        ) : still ? (
          <img className="lumia-camera-viewfinder-frame"
            src={`data:image/jpeg;base64,${still.data}`}
            alt="Fotograma exacto de la cámara utilizado en la solicitud visual de LUMIA"/>
        ) : null}
        {live&&!ready&&!error&&
          <span className="lumia-camera-viewfinder-placeholder" role="status">
            Solicitando permiso y preparando vista previa…
          </span>}
        {live&&error&&
          <span className="lumia-camera-viewfinder-placeholder is-error" role="alert">
            {error}
          </span>}
        <div className="lumia-camera-viewfinder-corners" aria-hidden="true">
          <span/><span/><span/><span/>
        </div>
      </div>
      {signalWarning&&live&&(
        <p className="lumia-camera-signal-warning" role="status">
          {signalWarning}
        </p>
      )}
      {!live && still && (
        <section className="lumia-camera-followup" aria-label="Conversación con la foto">
          <p className="lumia-camera-followup-status" role="status">
            {visualContextReady
              ? 'Puedes preguntarme por esta misma imagen, también por voz. No encenderé otra vez la cámara.'
              : 'Analizando imagen… Las preguntas de seguimiento estarán disponibles al finalizar.'}
          </p>
          <form className="lumia-camera-followup-form" onSubmit={(event)=>{
            event.preventDefault()
            const question=followupDraft.trim()
            if(!question || !visualContextReady)return
            setFollowupDraft('')
            onAskAboutStill(question)
          }}>
            <input type="text" value={followupDraft} maxLength={400}
              aria-label="Pregunta sobre la misma fotografía"
              placeholder="¿Qué hay detrás? ¿De qué color es…?"
              disabled={!visualContextReady}
              onChange={(event)=>setFollowupDraft(event.target.value)}/>
            <button type="submit" disabled={!visualContextReady||!followupDraft.trim()}>
              Preguntar
            </button>
          </form>
          <p className="lumia-camera-followup-privacy">
            Foto temporal · 5 minutos · se descarta al cerrar.
          </p>
        </section>
      )}
      <footer className="lumia-camera-viewfinder-actions">
        {live ? (
          <>
            <span className="lumia-camera-viewfinder-help">
              Encuadra el objeto. Nada se envía hasta capturar.
            </span>
            <button type="button" className="lumia-camera-viewfinder-primary"
              disabled={!ready} onClick={capture}>
              Capturar y analizar
            </button>
            <button type="button" className="lumia-camera-viewfinder-secondary"
              onClick={close}>Cerrar cámara</button>
          </>
        ) : (
          <>
            <span className="lumia-camera-viewfinder-help">
              Esto es lo que recibió LUMIA. La cámara ya se liberó.
            </span>
            <button type="button" className="lumia-camera-viewfinder-secondary"
              onClick={onReopen}>Volver a encuadrar</button>
            <button type="button" className="lumia-camera-viewfinder-secondary"
              onClick={close}>Cerrar imagen</button>
          </>
        )}
      </footer>
    </aside>
  )
}
