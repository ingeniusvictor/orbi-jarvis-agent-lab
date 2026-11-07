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

type Props={
  live:boolean
  still:LocalVisualImage|null
  onCaptured:(image:LocalVisualImage)=>void
  onClose:()=>void
  onReopen:()=>void
}

export function LumiaCameraViewfinder({
  live,still,onCaptured,onClose,onReopen,
}:Props){
  const videoRef=useRef<HTMLVideoElement>(null)
  const releaseRef=useRef<(()=>void)|null>(null)
  const closeRef=useRef(onClose)
  closeRef.current=onClose
  const [ready,setReady]=useState(false)
  const [error,setError]=useState('')

  useEffect(()=>{
    if(!live)return
    let cancelled=false
    let held=false
    let source:MediaStream|null=null
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
    void (async()=>{
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
      setReady(true)
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
      release()
      if(releaseRef.current===release)releaseRef.current=null
    }
  },[live])

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
