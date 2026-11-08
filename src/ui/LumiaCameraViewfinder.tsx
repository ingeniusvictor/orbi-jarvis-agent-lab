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
import {prepareVisualCameraFrame,prepareVisualImage,VISION_RESOLUTION_CHOICES,type LocalVisualImage,type VisionResolution} from '../lib/visual-input'
import {inspectCameraSignal,connectedOrVirtualCameraHint} from '../lib/vision-camera-signal-vi022'
import type {VisionReplyMode} from '../lib/vision-context-vi023'
import {chooseVisionResolution} from '../lib/vision-routing-amr024'

type Props={
  live:boolean
  fileMode:boolean
  stillSource:'camera'|'file'
  still:LocalVisualImage|null
  onCaptured:(image:LocalVisualImage,resolution:VisionResolution)=>void
  onFileCaptured:(image:LocalVisualImage,originalFile:File|null,resolution:VisionResolution)=>void
  onSelectFileMode:()=>void
  onSelectCameraMode:()=>void
  onClose:()=>void
  onReopen:()=>void
  visualContextReady:boolean
  visualReplyMode:VisionReplyMode
  onVisualReplyModeChange:(mode:VisionReplyMode)=>void
  visionResolution:VisionResolution
  onVisionResolutionChange:(edge:VisionResolution)=>void
  visionAutoAvailable:boolean
  visionAutoEnabled:boolean
  onVisionAutoEnabledChange:(enabled:boolean)=>void
  onAskAboutStill:(question:string)=>void
  visualDetailOffer:'camera'|'file'|null
  visualDetailPurpose:'ocr'|'count'
  visualDetailBusy:boolean
  onRequestDetailedReanalysis:()=>void
}

export function LumiaCameraViewfinder({
  live,fileMode,stillSource,still,onCaptured,onFileCaptured,onSelectFileMode,onSelectCameraMode,onClose,onReopen,
  visualContextReady,visualReplyMode,onVisualReplyModeChange,visionResolution,onVisionResolutionChange,
  visionAutoAvailable,visionAutoEnabled,onVisionAutoEnabledChange,onAskAboutStill,
  visualDetailOffer,visualDetailPurpose,visualDetailBusy,onRequestDetailedReanalysis,
}:Props){
  const videoRef=useRef<HTMLVideoElement>(null)
  const fileRef=useRef<HTMLInputElement>(null)
  const fileRequest=useRef(0)
  const selectedFile=useRef<File|null>(null)
  const [fileImage,setFileImage]=useState<LocalVisualImage|null>(null)
  const [fileBusy,setFileBusy]=useState(false)
  const [fileError,setFileError]=useState('')
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
  const sceneQuestion='Lumi, describe exactamente lo que aparece en esta imagen y dime qué no puedes distinguir.'
  const sceneRoute=chooseVisionResolution(sceneQuestion,
    visionAutoAvailable && visionAutoEnabled ? 'auto' : visionResolution)
  const effectiveResolution=sceneRoute.resolution

  useEffect(()=>()=>{fileRequest.current++},[])
  useEffect(()=>{
    if(fileMode)return
    fileRequest.current++
    selectedFile.current=null
    setFileImage(null)
    setFileBusy(false)
    setFileError('')
  },[fileMode])
  const selectFile=async(file:File|null, maxEdge:VisionResolution=effectiveResolution)=>{
    selectedFile.current=file
    const request=++fileRequest.current
    setFileImage(null)
    setFileError('')
    if(!file)return
    setFileBusy(true)
    try{
      const jpeg=await prepareVisualImage(file,maxEdge)
      if(request===fileRequest.current)setFileImage(jpeg)
    }catch(err){
      if(request===fileRequest.current)setFileError(err instanceof Error?err.message:'No pude abrir la fotografía.')
    }finally{
      if(request===fileRequest.current)setFileBusy(false)
    }
  }

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
      const image=prepareVisualCameraFrame(video,effectiveResolution)
      releaseRef.current?.() // release BEFORE Ollama starts, not in a later effect
      setReady(false)
      setError('')
      onCaptured(image,effectiveResolution)
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
          {live?'EN VIVO · SIN ANALIZAR':fileMode?'ARCHIVO LOCAL · SIN ANALIZAR':'FOTOGRAMA CAPTURADO'}
        </span>
        <button type="button" className="lumia-camera-viewfinder-close"
          aria-label="Cerrar visor y liberar cámara" title="Cerrar cámara"
          onClick={close}>×</button>
      </header>
      <div className="lumia-vision-source-tabs" role="group" aria-label="Origen de imagen">
        <button type="button" aria-pressed={live || (!fileMode && stillSource==='camera')}
          className={live || (!fileMode && stillSource==='camera')?'is-selected':''}
          onClick={onSelectCameraMode}>Cámara web</button>
        <button type="button" aria-pressed={fileMode || (!live && stillSource==='file')}
          className={fileMode || (!live && stillSource==='file')?'is-selected':''}
          onClick={onSelectFileMode}>Cargar imagen</button>
      </div>
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
          {fileMode || (!live && stillSource==='file')
            ? 'Origen: archivo seleccionado manualmente · sin cámara'
            : `Origen usado: ${activeSource||'sin identificar'}`}
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
      {(live || fileMode) && (
        <div className="lumia-camera-resolution-selector" role="group"
          aria-label="Resolución máxima para la próxima fotografía">
          <span>CALIDAD IMAGEN{visionAutoAvailable&&visionAutoEnabled?` · AUTO ${effectiveResolution}px`:''}</span>
          {visionAutoAvailable && (
            <button type="button" aria-pressed={visionAutoEnabled}
              className={visionAutoEnabled?'is-selected':''}
              title="Automático conservador: 768 escenas, 1024 para lectura, 512 solo objetos simples"
              onClick={()=>{
                if(visionAutoEnabled)return
                onVisionAutoEnabledChange(true)
                const edge=chooseVisionResolution(sceneQuestion,'auto').resolution
                if(fileMode && selectedFile.current)void selectFile(selectedFile.current,edge)
              }}>AUTO</button>
          )}
          {VISION_RESOLUTION_CHOICES.map(edge=>(
            <button key={edge} type="button" aria-pressed={!visionAutoEnabled && visionResolution===edge}
              className={!visionAutoEnabled && visionResolution===edge?'is-selected':''}
              title={edge===512?'Rápida · objetos grandes':edge===768?'Equilibrada · escenas':'Detallada · textos pequeños'}
              onClick={()=>{
                if(visionResolution===edge && !visionAutoEnabled)return
                onVisionAutoEnabledChange(false)
                onVisionResolutionChange(edge)
                // Re-encode the same manually selected File; never use the
                // previous-resolution JPEG as the new source.
                if(fileMode && selectedFile.current)void selectFile(selectedFile.current,edge)
              }}>
              {edge} px
            </button>
          ))}
        </div>
      )}
      <div className="lumia-camera-viewfinder-viewport">
        {live ? (
          <video ref={videoRef} className="lumia-camera-viewfinder-video"
            muted playsInline autoPlay aria-label="Vista real de la webcam, sin espejo"/>
        ) : fileMode && fileImage ? (
          <img className="lumia-camera-viewfinder-frame"
            src={`data:image/jpeg;base64,${fileImage.data}`}
            alt="Vista previa de la fotografía seleccionada, aún sin enviar a Ollama"/>
        ) : still ? (
          <img className="lumia-camera-viewfinder-frame"
            src={`data:image/jpeg;base64,${still.data}`}
            alt="Fotograma exacto de la cámara utilizado en la solicitud visual de LUMIA"/>
        ) : null}
        {fileMode&&!fileImage&&(
          <span className="lumia-camera-viewfinder-placeholder" role="status">
            {fileBusy?'Preparando fotografía local…':'Selecciona una imagen para previsualizarla antes de analizar.'}
          </span>
        )}
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
      {fileMode&&(
        <section className="lumia-vision-file-controls" aria-label="Cargar fotografía local">
          <input ref={fileRef} type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            aria-label="Seleccionar imagen JPG PNG o WebP"
            onChange={(event)=>{
              const selected=event.currentTarget.files?.[0]??null
              void selectFile(selected)
              event.currentTarget.value=''
            }}/>
          <p>JPG, PNG o WEBP · máximo 12 MB · se convierte a JPEG localmente.</p>
          {fileError&&<p className="lumia-vision-file-error" role="alert">{fileError}</p>}
        </section>
      )}
      {signalWarning&&live&&(
        <p className="lumia-camera-signal-warning" role="status">
          {signalWarning}
        </p>
      )}
      {!live && still && visualContextReady && visualDetailOffer && (
        <section className="lumia-camera-detail-offer" role="status" aria-label="Mejorar detalle de la fotografía">
          <p>{visualDetailPurpose==='count'
            ? visualDetailOffer==='file'
              ? 'Para contar grupos de personas con más detalle, puedes reanalizar el archivo original a 1024 px.'
              : 'Para contar grupos de personas con más detalle, puedes volver a encuadrar la cámara a 1024 px.'
            : visualDetailOffer==='file'
              ? 'Para leer letras pequeñas, puedes volver al archivo original y reanalizarlo a 1024 px.'
              : 'Para leer letras pequeñas, es necesario encuadrar de nuevo la cámara a 1024 px.'}</p>
          <button type="button" disabled={visualDetailBusy}
            onClick={onRequestDetailedReanalysis}>
            {visualDetailBusy?'Preparando fotografía…'
              :visualDetailPurpose==='count'
                ? visualDetailOffer==='file'?'Reanalizar grupo a 1024 px':'Volver a encuadrar grupo a 1024 px'
                :visualDetailOffer==='file'?'Reanalizar archivo original a 1024 px'
                :'Volver a encuadrar a 1024 px'}
          </button>
          <p>Se requiere tu acción. Nunca se abre la cámara ni se envían fotos automáticamente.</p>
        </section>
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
        {fileMode ? (
          <>
            <span className="lumia-camera-viewfinder-help">
              La foto solo se envía a Ollama al pulsar Analizar imagen. No se activa la webcam.
            </span>
            <button type="button" className="lumia-camera-viewfinder-primary"
              disabled={!fileImage||fileBusy} onClick={()=>{if(fileImage)onFileCaptured(fileImage,selectedFile.current,effectiveResolution)}}>
              Analizar imagen
            </button>
            <button type="button" className="lumia-camera-viewfinder-secondary"
              onClick={close}>Cerrar</button>
          </>
        ) : live ? (
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
              Esto es lo que recibió LUMIA. No hay cámara activa.
            </span>
            <button type="button" className="lumia-camera-viewfinder-secondary"
              onClick={onReopen}>{stillSource==='file'?'Elegir otra imagen':'Volver a encuadrar'}</button>
            <button type="button" className="lumia-camera-viewfinder-secondary"
              onClick={close}>Cerrar imagen</button>
          </>
        )}
      </footer>
    </aside>
  )
}
