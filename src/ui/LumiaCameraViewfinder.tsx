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
import {ACTIVE_VISION_SAMPLE_MS,ACTIVE_VISION_MAX_SESSION_MS,type ActiveVisionFrame} from '../lib/vision-active-vi031'
import {OpticalSentinel,SENTINEL_WIDTH,SENTINEL_HEIGHT,SENTINEL_INTERVAL_MS,toSentinelLuma,type SentinelZone} from '../lib/vision-sentinel-vi032'
import {FaceCountGate,FACE_DETECTOR_INTERVAL_MS,FACE_DETECTOR_MAX_WIDTH,FACE_DETECTOR_MAX_HEIGHT,type FaceBox} from '../lib/vision-faces-vi04'

type Props={
  live:boolean
  fileMode:boolean
  stillSource:'camera'|'file'
  still:LocalVisualImage|null
  onCaptured:(image:LocalVisualImage,resolution:VisionResolution)=>void
  visionActiveAvailable:boolean
  sentinelAvailable:boolean
  faceDetectorAvailable:boolean
  onActiveVisionChange:(active:boolean)=>void
  onActiveVisionFrame:(image:LocalVisualImage,resolution:VisionResolution,at:number)=>void
  onRegisterActiveCapture:(fn:(()=>ActiveVisionFrame|null)|null)=>void
  onAnalyzeLiveFrame:(image:LocalVisualImage,resolution:VisionResolution)=>void
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
  visionActiveAvailable,sentinelAvailable,faceDetectorAvailable,onActiveVisionChange,onActiveVisionFrame,onAnalyzeLiveFrame,onRegisterActiveCapture,
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
  const onActiveRef=useRef(onActiveVisionChange)
  onActiveRef.current=onActiveVisionChange
  const onFrameRef=useRef(onActiveVisionFrame)
  onFrameRef.current=onActiveVisionFrame
  const activeRef=useRef(false)
  const sampleTimerRef=useRef<number|null>(null)
  const sessionTimerRef=useRef<number|null>(null)
  const previewExpiryRef=useRef<number|null>(null)
  const sentinelTimerRef=useRef<number|null>(null)
  const sentinelCanvasRef=useRef<HTMLCanvasElement|null>(null)
  const sentinelRef=useRef(new OpticalSentinel())
  const sentinelZoneRef=useRef<SentinelZone>('center')
  const lastActiveShotRef=useRef(0)
  const captureForVoiceRef=useRef<()=>ActiveVisionFrame|null>(()=>null)
  const [sentinelZone,setSentinelZone]=useState<SentinelZone>('center')
  const [sentinelEvents,setSentinelEvents]=useState(0)
  const [visionActive,setVisionActive]=useState(false)
  const [visionSamples,setVisionSamples]=useState(0)
  const faceGateRef=useRef(new FaceCountGate())
  const [faceEnabled,setFaceEnabled]=useState(false)
  const [faceStatus,setFaceStatus]=useState<'off'|'loading'|'ready'|'error'>('off')
  const [faceError,setFaceError]=useState('')
  const [faceBoxes,setFaceBoxes]=useState<FaceBox[]>([])
  const [faceCount,setFaceCount]=useState<number|null>(null)
  const [faceLatency,setFaceLatency]=useState<number|null>(null)
  const [faceVideoSize,setFaceVideoSize]=useState({width:1280,height:720})
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

  const endActive=()=>{
    if(sampleTimerRef.current!==null){window.clearInterval(sampleTimerRef.current);sampleTimerRef.current=null}
    if(sessionTimerRef.current!==null){window.clearTimeout(sessionTimerRef.current);sessionTimerRef.current=null}
    if(sentinelTimerRef.current!==null){window.clearInterval(sentinelTimerRef.current);sentinelTimerRef.current=null}
    sentinelRef.current.reset()
    sentinelCanvasRef.current=null
    setFaceEnabled(false)
    faceGateRef.current.reset()
    setFaceBoxes([])
    setFaceCount(null)
    const wasActive=activeRef.current
    activeRef.current=false
    if(wasActive){onActiveRef.current(false);setVisionActive(false)}
  }
  // Unmount, source change and tab suspension must not retain image sampling.
  useEffect(()=>()=>{
    if(sampleTimerRef.current!==null)window.clearInterval(sampleTimerRef.current)
    if(sessionTimerRef.current!==null)window.clearTimeout(sessionTimerRef.current)
    if(sentinelTimerRef.current!==null)window.clearInterval(sentinelTimerRef.current)
    sentinelCanvasRef.current=null
    sentinelRef.current.reset()
    if(activeRef.current){activeRef.current=false;onActiveRef.current(false)}
  },[])
  useEffect(()=>{if(!live)endActive()},[live])

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
      setFaceVideoSize({width:video.videoWidth||1280,height:video.videoHeight||720})
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
    previewExpiryRef.current=expiry
    const onHidden=()=>{if(document.visibilityState==='hidden'&&activeRef.current)closeRef.current()}
    document.addEventListener('visibilitychange',onHidden)
    return ()=>{
      cancelled=true
      window.clearTimeout(expiry)
      if(previewExpiryRef.current===expiry)previewExpiryRef.current=null
      document.removeEventListener('visibilitychange',onHidden)
      if(inspectionTimer)clearTimeout(inspectionTimer)
      release()
      if(releaseRef.current===release)releaseRef.current=null
    }
  },[live,deviceChoice])

  // VISION-04A: FaceDetector runs in a dedicated Web Worker on the CPU.
  // It NEVER requests its own camera, performs recognition, or records faces.
  useEffect(()=>{
    if(!faceDetectorAvailable||!faceEnabled||!live||!visionActive||!ready)return
    let cancelled=false
    let workerReady=false
    let busy=false
    let sequence=0
    let sampleTimer:number|null=null
    let responseTimer:number|null=null
    const worker=new Worker(new URL('../lib/vision-face-worker-vi04.ts',import.meta.url),{type:'module'})
    faceGateRef.current.reset()
    setFaceCount(null)
    setFaceBoxes([])
    setFaceError('')
    setFaceStatus('loading')

    const fail=(reason:string)=>{
      if(cancelled)return
      workerReady=false
      setFaceStatus('error')
      setFaceError(reason.slice(0,160))
      setFaceBoxes([])
      setFaceCount(null)
      if(sampleTimer!==null){window.clearInterval(sampleTimer);sampleTimer=null}
      if(responseTimer!==null){window.clearTimeout(responseTimer);responseTimer=null}
      worker.terminate()
    }
    const sample=async()=>{
      if(cancelled||!workerReady||busy||document.visibilityState!=='visible')return
      const video=videoRef.current
      if(!video||video.readyState<2||video.videoWidth===0||video.videoHeight===0)return
      busy=true
      try{
        const scale=Math.min(1,FACE_DETECTOR_MAX_WIDTH/video.videoWidth,
          FACE_DETECTOR_MAX_HEIGHT/video.videoHeight)
        const width=Math.max(1,Math.round(video.videoWidth*scale))
        const height=Math.max(1,Math.round(video.videoHeight*scale))
        const bitmap=await createImageBitmap(video,{
          resizeWidth:width,resizeHeight:height,resizeQuality:'medium',
        })
        if(cancelled||!workerReady){bitmap.close();busy=false;return}
        worker.postMessage({
          type:'FRAME',bitmap,timestampMs:performance.now(),sequence:++sequence,
        },[bitmap])
        responseTimer=window.setTimeout(()=>fail('La detección facial tardó demasiado y fue detenida.'),6_000)
      }catch(err){
        busy=false
        fail(err instanceof Error?err.message:'No pude preparar el video para el detector.')
      }
    }
    worker.onmessage=(event:MessageEvent<{
      type:string;sequence?:number;faces?:FaceBox[];elapsedMs?:number;message?:string
    }>)=>{
      if(cancelled)return
      const msg=event.data
      if(msg.type==='READY'){
        workerReady=true
        setFaceStatus('ready')
        void sample()
        sampleTimer=window.setInterval(()=>{void sample()},FACE_DETECTOR_INTERVAL_MS)
      }else if(msg.type==='RESULT'){
        if(responseTimer!==null){window.clearTimeout(responseTimer);responseTimer=null}
        busy=false
        if(msg.sequence!==sequence||!Array.isArray(msg.faces))return
        setFaceBoxes(msg.faces)
        setFaceCount(faceGateRef.current.observe(msg.faces.length,Date.now()))
        setFaceLatency(Number.isFinite(msg.elapsedMs)?Math.round(msg.elapsedMs!):null)
      }else if(msg.type==='ERROR'){
        fail(msg.message||'No se pudo ejecutar el detector facial.')
      }
    }
    worker.onerror=()=>fail('Falló el proceso local de detección facial.')
    worker.postMessage({type:'INIT'})
    return ()=>{
      cancelled=true
      if(sampleTimer!==null)window.clearInterval(sampleTimer)
      if(responseTimer!==null)window.clearTimeout(responseTimer)
      worker.terminate()
      faceGateRef.current.reset()
    }
  },[faceDetectorAvailable,faceEnabled,live,visionActive,ready])

  const close=()=>{
    endActive()
    releaseRef.current?.()
    onClose()
  }
  const takeActiveFrame=():LocalVisualImage|null=>{
    const video=videoRef.current
    if(!activeRef.current||!ready||!video||document.visibilityState==='hidden')return null
    if(camera.cameraStream()?.getVideoTracks()[0]?.readyState!=='live'){
      closeRef.current()
      return null
    }
    try{
      const image=prepareVisualCameraFrame(video,effectiveResolution)
      const shotAt=Date.now()
      onFrameRef.current(image,effectiveResolution,shotAt)
      lastActiveShotRef.current=shotAt
      setVisionSamples(n=>n+1)
      return image
    }catch(err){
      setError(err instanceof Error?err.message:'No se pudo actualizar el fotograma.')
      closeRef.current()
      return null
    }
  }
  /** Two samples per second are not needed for change detection on this CPU.
   * A 96x54 RGBA copy at 750ms is sufficient for an initial owner pilot.
   * Only motion metadata stays in the browser; Ollama is NEVER called here. */
  const sampleSentinel=()=>{
    const video=videoRef.current
    if(!sentinelAvailable||!activeRef.current||!ready||!video||document.visibilityState==='hidden')return
    if(camera.cameraStream()?.getVideoTracks()[0]?.readyState!=='live'){
      closeRef.current()
      return
    }
    try{
      let canvas=sentinelCanvasRef.current
      if(!canvas){
        canvas=document.createElement('canvas')
        canvas.width=SENTINEL_WIDTH
        canvas.height=SENTINEL_HEIGHT
        sentinelCanvasRef.current=canvas
      }
      const ctx=canvas.getContext('2d',{willReadFrequently:true})
      if(!ctx)return
      ctx.drawImage(video,0,0,SENTINEL_WIDTH,SENTINEL_HEIGHT)
      const luma=toSentinelLuma(ctx.getImageData(0,0,SENTINEL_WIDTH,SENTINEL_HEIGHT).data)
      const now=Date.now()
      const observed=sentinelRef.current.observe(luma,sentinelZoneRef.current,now)
      if(observed.status==='event'){
        setSentinelEvents(n=>n+1)
        // An event makes a fresher local JPEG available to voice queries.
        // Never calls Ollama, speaks, opens another camera or queues an inference.
        if(now-lastActiveShotRef.current>=3_000)takeActiveFrame()
      }
    }catch{
      // Fail closed: an unreadable stream should not remain in observation.
      closeRef.current()
    }
  }
  const chooseSentinelZone=(zone:SentinelZone)=>{
    if(zone===sentinelZoneRef.current)return
    sentinelZoneRef.current=zone
    sentinelRef.current.reset()
    setSentinelZone(zone)
    setSentinelEvents(0)
  }
  // A user voice request captures the *current* shared webcam frame. No
  // second getUserMedia and no reused 12-second snapshot presented as current.
  captureForVoiceRef.current=()=>{
    if(!activeRef.current)return null
    const image=takeActiveFrame()
    return image ? {image,resolution:effectiveResolution,capturedAt:lastActiveShotRef.current} : null
  }
  useEffect(()=>{
    onRegisterActiveCapture(()=>captureForVoiceRef.current())
    return ()=>onRegisterActiveCapture(null)
  },[onRegisterActiveCapture])
  const beginActive=()=>{
    if(!visionActiveAvailable||!live||!ready||activeRef.current)return
    activeRef.current=true
    setVisionActive(true)
    setVisionSamples(0)
    setSentinelEvents(0)
    sentinelRef.current.reset()
    lastActiveShotRef.current=0
    onActiveRef.current(true)
    // The owner explicitly opted in; replace the preview's 90 s expiry
    // with one bounded 3-minute observation session. No indefinite lease.
    if(previewExpiryRef.current!==null){window.clearTimeout(previewExpiryRef.current);previewExpiryRef.current=null}
    takeActiveFrame()
    if(!activeRef.current)return
    sampleTimerRef.current=window.setInterval(()=>{void takeActiveFrame()},ACTIVE_VISION_SAMPLE_MS)
    if(sentinelAvailable){
      sampleSentinel()
      sentinelTimerRef.current=window.setInterval(sampleSentinel,SENTINEL_INTERVAL_MS)
    }
    sessionTimerRef.current=window.setTimeout(()=>closeRef.current(),ACTIVE_VISION_MAX_SESSION_MS)
  }
  const analyzeLiveNow=()=>{
    const image=takeActiveFrame()
    if(image)onAnalyzeLiveFrame(image,effectiveResolution)
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
          {visionActive?'VISIÓN ACTIVA · CÁMARA ABIERTA':live?'EN VIVO · SIN ANALIZAR':fileMode?'ARCHIVO LOCAL · SIN ANALIZAR':'FOTOGRAMA CAPTURADO'}
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
      {live&&visionActiveAvailable&&(
        <div className="lumia-vision-active-bar" role="group" aria-label="Sesión de visión activa">
          <button type="button" disabled={!ready&&!visionActive}
            onClick={visionActive?close:beginActive}>
            {visionActive?'Detener visión':'Activar visión'}
          </button>
          <span role="status">{visionActive
            ? `${visionSamples} capturas · cada 12 s · máximo 3 min`
            : 'Foto periódica en memoria · análisis solo al preguntar'}</span>
        </div>
      )}
      {live&&sentinelAvailable&&visionActive&&(
        <div className="lumia-vision-sentinel-panel" role="group" aria-label="Centinela óptico CPU">
          <span role="status">CENTINELA CPU · cambios ópticos: {sentinelEvents}</span>
          <div className="lumia-vision-sentinel-zones" role="group" aria-label="Zona de observación">
            <button type="button" aria-pressed={sentinelZone==='center'}
              onClick={()=>chooseSentinelZone('center')}>Centro</button>
            <button type="button" aria-pressed={sentinelZone==='full'}
              onClick={()=>chooseSentinelZone('full')}>Toda la imagen</button>
          </div>
          <small>Detecta cambios ópticos, no personas. Cerebro 2B predeterminado, análisis solo al preguntar.</small>
        </div>
      )}
      {live&&faceDetectorAvailable&&visionActive&&(
        <div className="lumia-face-detector-panel" role="group" aria-label="Detección local de rostros">
          <div className="lumia-face-detector-head">
            <button type="button" aria-pressed={faceEnabled}
              onClick={()=>{
                if(faceEnabled){
                  setFaceEnabled(false)
                  setFaceStatus('off')
                  setFaceBoxes([])
                  setFaceCount(null)
                  setFaceError('')
                }else{
                  setFaceEnabled(true)
                }
              }}>{faceEnabled?'Detener detector facial':'Detectar rostros · CPU'}</button>
            <span role="status">
              {!faceEnabled?'Apagado':faceStatus==='loading'?'Cargando modelo local…'
                :faceStatus==='error'?'Error de detector'
                :faceCount===null?'Confirmando rostros…'
                :faceCount===1?'1 rostro detectado':faceCount+' rostros detectados'}
            </span>
          </div>
          {faceEnabled&&faceStatus==='ready'&&faceLatency!==null&&(
            <small>MediaPipe CPU · último análisis: {faceLatency} ms · sin identificación personal</small>
          )}
          {faceError&&<p role="alert" className="lumia-face-detector-error">{faceError}</p>}
          <small>Solo detecta rostros presentes; todavía no reconoce nombres.</small>
        </div>
      )}
      <div className="lumia-camera-source">
        {live ? (
          <>
            <label htmlFor="lumia-camera-device">CÁMARA</label>
            <select id="lumia-camera-device"
              aria-label="Seleccionar cámara de LUMIA"
              title="Cambiar entre webcam integrada, cámaras USB y cámaras virtuales"
              value={deviceChoice}
              disabled={visionActive||(!ready&&!error)}
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
              disabled={visionActive}
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
              disabled={visionActive}
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
          <>
            <video ref={videoRef} className="lumia-camera-viewfinder-video"
              muted playsInline autoPlay aria-label="Vista real de la webcam, sin espejo"/>
            {visionActive&&sentinelAvailable&&sentinelZone==='center'&&(
              <svg className="lumia-vision-sentinel-overlay" viewBox="0 0 100 100"
                preserveAspectRatio="none" aria-hidden="true">
                <polygon points="16,15 84,15 84,88 16,88"/>
              </svg>
            )}
            {visionActive&&faceEnabled&&faceStatus==='ready'&&faceBoxes.length>0&&(
              <svg className="lumia-face-detector-overlay"
                viewBox={`0 0 ${faceVideoSize.width} ${faceVideoSize.height}`}
                preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                {faceBoxes.map((face,i)=>(
                  <g key={i}>
                    <rect x={face.x*faceVideoSize.width}
                      y={face.y*faceVideoSize.height}
                      width={face.width*faceVideoSize.width}
                      height={face.height*faceVideoSize.height}/>
                    <text x={face.x*faceVideoSize.width}
                      y={Math.max(20,face.y*faceVideoSize.height-5)}
                      fontSize={Math.max(13,faceVideoSize.width/60)}>
                      Rostro {i+1}
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </>
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
              {visionActive?'Pregunta por voz lo que ves; la cámara permanece abierta.':'Encuadra el objeto. Nada se envía hasta capturar.'}
            </span>
            {visionActive ? <button type="button" className="lumia-camera-viewfinder-primary"
              disabled={!ready} onClick={analyzeLiveNow}>Analizar ahora</button>
              : <button type="button" className="lumia-camera-viewfinder-primary"
                disabled={!ready} onClick={capture}>Capturar y analizar</button>}
            <button type="button" className="lumia-camera-viewfinder-secondary"
              onClick={close}>{visionActive?'Detener visión':'Cerrar cámara'}</button>
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
