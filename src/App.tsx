import { useEffect, useRef, useState } from 'react'
import { Scene } from './scene/Scene'
import { Hud } from './ui/Hud'
import { Boot } from './ui/Boot'
import { Ignition } from './ui/Ignition'
import { Diagnostics } from './ui/Diagnostics'
import { RealtimeTrial } from './ui/RealtimeTrial'
import { AcousticLab } from './ui/AcousticLab'
import { VisualInput } from './ui/VisualInput'
import { LumiaComposer } from './ui/LumiaComposer'
import { LumiaCameraViewfinder } from './ui/LumiaCameraViewfinder'
import type { LocalVisualImage } from './lib/visual-input'
import {cameraVisionPrompt,captureLumiaAuthorizedStill,parseLumiaCameraIntent} from './lib/vision-camera-vi02'
import {EphemeralVisualContext,VISION_CONTEXT_TTL_MS,followupVisionPrompt,visualModeInstruction,type VisionReplyMode} from './lib/vision-context-vi023'
import { isRealtimePilotUiEnabled } from './lib/realtime-voice'
import { useStore } from './store'
import {
  startVoice,
  diag as voiceDiag,
  type Voice,
  type VoiceMode,
  type VoiceTranscriptEvent,
} from './lib/voice'
import { ACTIVE_COMMAND_GRACE_MS, voiceModeForPhase } from './lib/voice-focus'
import { shouldProtectWhisperCommandAtExpiry } from './lib/complex-voice-turn'
import { remainingLongQuestionWindow } from './lib/long-question'
import { createSpeaker, cycleVoice, currentVoiceName, diag as ttsDiag, ECHO_TAIL_MS } from './lib/tts'
import { portalSpeechStart, portalSpeechPhrase, portalSpeechEnd, portalSpeechInterrupt } from './scene/lumia-head/portal-speech-events'
import { parseLumiaAvatarAction, respondToLumiaAvatarAction } from './scene/lumia-motion-r8/avatar-presence-ph04'
import { LUMIA_GUIDED_DEMO_STEPS, beginGuidedDemo, cancelGuidedDemo, cueGuidedDemoPhrase, cueGuidedDemoStage, endGuidedDemo, checkGuidedDemoAssets, guidedDemoScript, guidedDemoSnapshot, waitForGuidedDemoClip } from './scene/lumia-motion-r8/avatar-demo-ph045'
import { LumiaDemoIndicator } from './ui/LumiaDemoIndicator'

import { resolveFollowupGuardMs } from './lib/followup-latency'
import * as sfx from './lib/sfx'
import * as music from './lib/music'
import * as hands from './lib/hands'
import { listenForClap } from './lib/clap'
import * as camera from './lib/camera'
import * as kokoro from './lib/kokoro'
import { TTS_ENGINE } from './config'
import { forTool, attention } from './lib/fillers'
import {
  ask,
  warm,
  interrupt,
  watchServers,
  watchPanels,
  watchBlades,
  watchCapture,
  watchUi,
  watchVoiceRuntime,
  watchConnection,
  connectedLabels,
  usingBridge,
  type Msg,
} from './lib/brain'
import { startAnalyser, micLevel, releaseMicrophone } from './lib/audio'
import { audioBlobToPcmWav } from './lib/wav'
import { startPushCapture, PUSH_CAPTURE_MAX_MS, type PushCapture } from './lib/push-to-talk'
import { initialLumiaInputMode, shouldRunAlwaysOnVoice, type LumiaInputMode } from './lib/input-mode'
import { BRIDGE_HTTP_URL } from './config'
import { translateLocalText, translateLocalAudioFile, AudioTranslationError, type TranslationLanguage } from './lib/translate'
import {
  applyVoiceRuntimeSnapshot,
  caps,
  probeCapabilities,
} from './lib/capabilities'
import { env } from './config'

/**
 * The conversation.
 *
 * This used to be a sequential loop — greet, await a capture, await an answer,
 * repeat — with the microphone opened and closed around each step. That shape
 * cannot be interrupted: while it is awaiting the answer, nothing is listening,
 * so there is no way for the user to get a word in.
 *
 * It is an event machine now. The voice loop runs continuously and pushes
 * events at us; every one of them is legal in every phase. Saying anything at
 * all stops him talking, and whatever you say next becomes the new turn.
 */

/** How long to wait for someone to start speaking after he wakes. Generous:
 *  people say his name and *then* think about what they wanted. */
const AWAIT_SPEECH_MS = 14000

/** After an answer, how long the mic stays open for a follow-up before he
 *  drops back to standby. Long enough that you don't have to say the name
 *  again to continue a thought. */
const FOLLOW_UP_MS = 11000

/** Chrome may deliver the assistant's own final words back through
 * SpeechRecognition after TTS has technically ended. Keep the app in guard mode
 * briefly so those delayed echo results are discarded instead of becoming a
 * brand-new user turn that makes L.U.M.I.A. answer herself in a loop. */
const FAST_LOCAL_FOLLOWUP = import.meta.env.VITE_LUMIA_FAST_LOCAL_FOLLOWUP === '1'
const ACTIVE_COMMAND_GRACE_ENABLED = import.meta.env.VITE_LUMIA_ACTIVE_COMMAND_GRACE === '1'
const LONG_QUESTION_INPUT_ENABLED = import.meta.env.VITE_LUMIA_LONG_QUESTION_INPUT === '1'
const COMPLEX_VOICE_ENABLED = import.meta.env.VITE_LUMIA_COMPLEX_VOICE_VQ01 === '1'
const MULTIMODAL_COMPOSER = import.meta.env.VITE_LUMIA_MULTIMODAL_COMPOSER === '1'
const AVATAR_PH04_ENABLED = import.meta.env.VITE_LUMIA_AVATAR_PH04 === '1'
const CAMERA_VISION_VI02_ENABLED = usingBridge &&
  import.meta.env.VITE_LUMIA_VISUAL_INPUT_VI01 === '1' &&
  import.meta.env.VITE_LUMIA_VISION_CAMERA_VI02 === '1'

// Owner-side opt-in only. The browser recognizer remains at the certified hold.
// Never start listening before the actual synthesized-output echo tail expires.
const followupGuardMs = () =>
  resolveFollowupGuardMs({
    engine: voiceDiag.engine,
    fastLocalFollowup: FAST_LOCAL_FOLLOWUP,
    echoTailMs: ECHO_TAIL_MS,
  })

/** crypto.randomUUID needs a secure context, which a LAN address over plain
 *  http is not. Not worth failing a whole turn over an id. */
const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `id${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

/** The same mishearings voice.ts accepts for the wake word — otherwise a turn
 *  that woke him as "travis" gets that word sent on to the model as a question. */
const NAME = '(?:lumi|lumia|lumi a|jarvis|jarvys|jervis|travis|jarviss|java\'s|jarv)'
/** A bare vocative — "Jarvis", "hey jarvis" — with nothing asked. */
const BARE_NAME = new RegExp(`^(?:hey|hi|ok|okay|yo|oye|hola)?\\s*${NAME}[\\s,.!?]*$`, 'i')
/** A leading vocative on a real command: "Jarvis, what's the weather". */
const LEADING_NAME = new RegExp(`^(?:hey|hi|ok|okay|yo|oye|hola)?\\s*${NAME}\\b[\\s,.:!?-]*`, 'i')

export default function App() {
  const store = useStore
  const phase = useStore((s) => s.phase)
  const history = useRef<Msg[]>([])
  const [inputMode, setInputMode] = useState<LumiaInputMode>(
    initialLumiaInputMode(MULTIMODAL_COMPOSER),
  )
  const inputModeRef = useRef<LumiaInputMode>(initialLumiaInputMode(MULTIMODAL_COMPOSER))
  const [pushRecording, setPushRecording] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [cameraCapturing,setCameraCapturing] = useState(false)
  const [cameraPreviewOpen,setCameraPreviewOpen] = useState(false)
  const [cameraStill,setCameraStill] = useState<LocalVisualImage|null>(null)
  const [visionReplyMode,setVisionReplyMode] = useState<VisionReplyMode>('breve')
  const [visionContextReady,setVisionContextReady] = useState(false)
  const visualSession = useRef(new EphemeralVisualContext())
  const activeVisualReply = useRef<string|null>(null)
  const cameraCaptureOwner = useRef<string|null>(null)
  // The captured JPEG is transient memory, never transcript/localStorage.
  // This timer erases even an unattended frozen picture after five minutes.
  useEffect(()=>{
    if(!cameraStill)return
    const expiry=window.setTimeout(()=>{
      visualSession.current.clear()
      setVisionContextReady(false)
      setCameraStill(null)
    },VISION_CONTEXT_TTL_MS)
    return ()=>window.clearTimeout(expiry)
  },[cameraStill])
  const pushCapture = useRef<PushCapture | null>(null)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pushGeneration = useRef(0)
  const speaker = useRef<ReturnType<typeof createSpeaker> | null>(null)
  const voice = useRef<Voice | null>(null)

  /**
   * Monotonic turn counter. Every await in a turn checks it on the way out:
   * if it has moved, that turn was superseded by a barge-in and must not touch
   * the phase, the speaker, or the busy state on its way to the floor.
   */
  const turn = useRef(0)
  const activeReply = useRef<string | null>(null)
  const booting = useRef(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commandWindowStartedAt = useRef(0)
  const commandGraceUsed = useRef(false)
  const commandExpiryAt = useRef(0)
  const voicePoll = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceRestart = useRef(0)
  // Exclusive voice-device test ownership: the paid WebRTC trial and the
  // local hardware test must NEVER share the normal assistant mic loop.
  const experimentOwner = useRef<'realtime' | 'acoustic' | null>(null)
  const [activeExperiment, setActiveExperiment] = useState<'realtime' | 'acoustic' | null>(null)

  // -- helpers --------------------------------------------------------------

  const clearIdle = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = null
  }

  const silence = () => {
    // Invalidate the visual voice session before TTS cancel() emits late events.
    portalSpeechInterrupt()
    cancelGuidedDemo()
    speaker.current?.cancel()
    speaker.current = null
  }

  const goDormant = () => {
    clearIdle()
    silence()
    turn.current++
    const s = store.getState()
    s.setCaption('')
    s.setActiveTool(null)
    music.working(false)
    music.duck(false)
    sfx.duck(false)
    s.setPhase('dormant')
  }

  // End the authorized listen window ONLY once already-captured local COMMAND
  // audio has been decoded. No standby or household-background authorization:
  // expired unfocused speech cannot reawaken LUMIA.
  const expireListening = () => {
    if (store.getState().phase !== 'listening') return
    const expiredByMs = Date.now() - commandExpiryAt.current
    if (shouldProtectWhisperCommandAtExpiry({
      enabled: COMPLEX_VOICE_ENABLED && voiceDiag.engine === 'whisper-local',
      authorized: inputModeRef.current === 'continuous',
      hasPending: Boolean(voice.current?.hasPendingCommand?.()),
      expiredByMs,
    })) {
      idleTimer.current = setTimeout(expireListening, 400)
      return
    }
    goDormant()
  }
  const scheduleCommandExpiry = (remainingMs: number) => {
    clearIdle()
    const ms = Math.max(1, remainingMs)
    commandExpiryAt.current = Date.now() + ms
    idleTimer.current = setTimeout(expireListening, ms)
  }

  /** Open the mic and wait. `window` is how long before he gives up. */
  const listen = (window: number) => {
    clearIdle()
    commandWindowStartedAt.current = Date.now()
    commandGraceUsed.current = false
    const s = store.getState()
    s.setCaption('')
    s.setPhase('listening')
    sfx.play('listen')
    scheduleCommandExpiry(window)
  }

  // -- one turn -------------------------------------------------------------

  const respond = async (said: string, image?: LocalVisualImage, cameraRequested = false, fromCameraPreview = false, forceVisualFollowUp = false): Promise<void> => {
    const mine = ++turn.current
    cancelGuidedDemo()
    const stale = () => mine !== turn.current
    const previousReply = activeReply.current
    if (previousReply) {
      store.getState().updateTurn(previousReply, {
        status: 'interrupted', finishedAt: Date.now(),
      })
    }

    clearIdle()
    const s = store.getState()
    // Last turn's panels and blades go now, before the new answer starts
    // putting its own up. Anything the model marked sticky survives.
    s.clearPanels()
    s.clearBlades()
    s.setCaption('')
    const acceptedAt = Date.now()
    s.pushTurn({ id: newId(), role: 'user', text: said, at: acceptedAt })
    const turnId = newId()
    activeReply.current = turnId
    // Show a pending response immediately, even when the brain never yields a
    // token. It is crucial evidence for 40s waits and unanswered questions.
    s.pushTurn({ id: turnId, role: 'jarvis', text: '', at: acceptedAt, status: 'pending' })
    s.setPhase('thinking')

    const responseStartedAt = performance.now()
    ttsDiag.firstTextMs = null
    ttsDiag.firstAudioMs = null
    const spk = createSpeaker(() => {
      // First *actual playback*, not the request to Kokoro or model output.
      if (!stale()) {
        ttsDiag.firstAudioMs = Math.round(performance.now() - responseStartedAt)
        portalSpeechStart(turnId)
        store.getState().updateTurn(turnId, {
          firstAudioAt: Date.now(), status: 'playing',
        })
      }
    }, (phrase) => {
      if (!stale()) {
        store.getState().pushSpokenSegment(turnId, phrase)
        portalSpeechPhrase(turnId, phrase.text)
        cueGuidedDemoPhrase(turnId, phrase.text)
      }
    })
    speaker.current = spk
    sfx.duck(true)
    music.duck(true)

    let started = false
    let filled = false
    let guidedRun = false

    try {
      // VISION-02: authorized one-shot camera frame. The camera lease is
      // released BEFORE local Ollama receives the JPEG; no background polling.
      // Ordinary voice-only turns never run this branch or pay its latency.
      // An authorized still can answer later scene questions without opening
      // the webcam again. Explicit new-camera commands still start a new shot.
      const visualFollowUp = CAMERA_VISION_VI02_ENABLED && !image && !cameraRequested
        ? forceVisualFollowUp
          ? visualSession.current.getAuthorizedFrame()
          : visualSession.current.getForFollowUp(said)
        : null
      // A newly attached file is a separate VI-01 image, not a follow-up
      // to a prior camera still: never silently send the old camera photo.
      if(image && !fromCameraPreview && !cameraRequested){
        visualSession.current.clear()
        setVisionContextReady(false)
        setCameraStill(null)
        setCameraPreviewOpen(false)
      }
      const cameraIntent = CAMERA_VISION_VI02_ENABLED && !image && !visualFollowUp
        ? parseLumiaCameraIntent(said) : null
      let visualImage=image ?? visualFollowUp?.image
      let visualGeneration:number|null=null
      let visualInferenceFailed=false
      let captureFailure=''
      if (cameraIntent || (cameraRequested && CAMERA_VISION_VI02_ENABLED)) {
        visualSession.current.clear()
        setVisionContextReady(false)
        setCameraStill(null)
        cameraCaptureOwner.current=turnId
        setCameraCapturing(true)
        s.setLooking('VISIÓN LOCAL · UNA FOTO SOLICITADA')
        try {
          visualImage=await captureLumiaAuthorizedStill(stale)
          if(!stale()){
            // This is the precise JPEG that local Ollama will receive, NOT
            // an imaginary live feed continuing after the shutter closes.
            setCameraStill(visualImage)
            setCameraPreviewOpen(false)
          }
        } catch(err) {
          if(stale())return
          const detail=err instanceof Error ? err.message : String(err)
          captureFailure=detail.includes('Permission') ||
            detail.includes('NotAllowed') || detail.includes('denied')
            ? 'No tengo permiso para utilizar la cámara. Autorízala en el navegador e inténtalo de nuevo.'
            : 'No pude capturar una imagen de la cámara. '+detail
        } finally {
          if(cameraCaptureOwner.current===turnId){
            cameraCaptureOwner.current=null
            setCameraCapturing(false)
            s.setLooking(null)
          }
        }
        if(stale())return
      }
      // Only an owner-clicked/voice-camera frame creates a reusable session.
      // A photo uploaded through VI-01 remains one-shot unless explicitly
      // captured by the existing camera viewer; no silent photo retention.
      if(visualImage && !visualFollowUp &&
         (cameraIntent || cameraRequested || fromCameraPreview)){
        visualGeneration=visualSession.current.begin(visualImage)
      }
      if(visualImage) activeVisualReply.current=turnId
      const avatarAction = AVATAR_PH04_ENABLED && !visualImage && !captureFailure
        ? parseLumiaAvatarAction(said) : null
      const { text } = captureFailure
        ? {text:captureFailure}
        : avatarAction?.kind === 'demo'
        ? { text: await (async () => {
            const assets = await checkGuidedDemoAssets()
            if (stale()) return ''
            if (!assets.available) {
              return 'Todavía no puedo iniciar la demostración completa. ' +
                'Faltan archivos locales Motion R8, por ejemplo: ' +
                assets.missing.slice(0, 3).join(', ') +
                '. Verifica la instalación de los diecisiete FBX.'
            }
            if (new URLSearchParams(window.location.search).get('lumiaR8') === 'procedural') {
              return 'Para demostrar las diecisiete animaciones necesito el modo R8 normal, no el modo procedural de respaldo.'
            }
            beginGuidedDemo(turnId)
            guidedRun = true
            return guidedDemoScript()
          })() }
        : avatarAction
        ? { text: respondToLumiaAvatarAction(avatarAction) }
        : await ask(visualFollowUp
          ? followupVisionPrompt(said,visionReplyMode)
          : visualImage
          ? (cameraIntent || cameraRequested || fromCameraPreview
              ? cameraVisionPrompt(cameraIntent?.question ?? said) : said) +
              visualModeInstruction(visionReplyMode)
          : said,
          history.current, {
        onText: (delta) => {
          if (stale()) return
          if (!started) {
            started = true
            ttsDiag.firstTextMs = Math.round(performance.now() - responseStartedAt)
            store.getState().updateTurn(turnId, {
              firstTextAt: Date.now(), status: 'generating',
            })
            store.getState().setPhase('speaking')
            // The answer arriving is what ends the tool phase — a timer would
            // clear the readout while a slow tool was still running.
            store.getState().setActiveTool(null)
            music.working(false)
          }
          store.getState().appendToTurn(turnId, delta)
          spk.push(delta)
        },
        onTool: (name) => {
          if (stale()) return
          // Only claim the tooling phase while he has nothing to say yet.
          // Setting it unconditionally pinned the machine in 'tooling' for the
          // rest of any answer that called a tool after it started talking,
          // which also broke the reactor's lip-sync for the remainder.
          if (!started) store.getState().setPhase('tooling')
          store.getState().setActiveTool(name)
          sfx.play('tool')
          music.working(true)
          // Say something the moment work starts — a tool can take ten seconds
          // and silence that long reads as a crash. Once per turn only; a
          // chain of five tools shouldn't produce five apologies.
          if (!filled && !started) {
            filled = true
            spk.say(forTool(name))
          }
        },
      }, visualImage).catch((err:unknown) => {
        if (!cameraIntent && !cameraRequested && !fromCameraPreview && !visualFollowUp) throw err
        if (stale()) throw err
        visualInferenceFailed=true
        // Never claim visual understanding if Ollama rejected the image.
        console.warn('[lumia:vision023] Local image inference unavailable:',
          err instanceof Error ? err.name : 'unknown')
        return {
          text: visualFollowUp
            ? 'No pude volver a analizar esa fotografía. Inténtalo nuevamente o toma otra imagen.'
            : 'Pude tomar la imagen, pero el modelo local no consiguió analizarla. ' +
              'Comprueba que el modelo activo admite imágenes en Ollama.',
          tools: [],
        }
      })

      if (stale()) return
      if(visualGeneration!==null && !visualInferenceFailed && text.trim() &&
         visualSession.current.confirmAnalyzed(visualGeneration)){
        setVisionContextReady(true)
      }

      // Some providers return only the final text and no streaming deltas.
      // Capture it rather than misclassifying a successful answer as silence.
      if (!started && text.trim()) {
        started = true
        ttsDiag.firstTextMs = Math.round(performance.now() - responseStartedAt)
        s.updateTurn(turnId, { text, firstTextAt: Date.now(), status: 'generating' })
        s.setPhase('speaking')
        if (!guidedRun) spk.push(text)
      }

      // The bridge keeps conversation state in its own session, so history is
      // only threaded through on the direct path.
      if (!usingBridge) {
        history.current.push({ role: 'user', content: said })
        history.current.push({ role: 'assistant', content: text || '…' })
        if (history.current.length > 16) {
          history.current = history.current.slice(-16)
        }
      }

      if (guidedRun) {
        // This is a scripted demonstration, NOT a fast conversational answer.
        // Use one already-approved Kokoro speaker per stage. A stage begins
        // only on audible playback, and the following stage waits for the
        // real FBX mixer to finish all authored repetitions. The ordinary
        // fast answer path above remains completely unchanged.
        let hasPlayedAudio = false
        for (const [index, step] of LUMIA_GUIDED_DEMO_STEPS.entries()) {
          if (stale() || !guidedDemoSnapshot().active) return
          let stageAudible = false
          const stageSpeaker = createSpeaker(() => {
            if (stale()) return
            portalSpeechStart(turnId)
            if (!hasPlayedAudio) {
              hasPlayedAudio = true
              ttsDiag.firstAudioMs = Math.round(performance.now() - responseStartedAt)
              store.getState().updateTurn(turnId, {
                firstAudioAt: Date.now(), status: 'playing',
              })
            }
          }, (phrase) => {
            if (stale()) return
            store.getState().pushSpokenSegment(turnId, phrase)
            portalSpeechPhrase(turnId, phrase.text)
            if (!stageAudible) {
              stageAudible = true
              cueGuidedDemoStage(turnId, index)
            }
          })
          speaker.current = stageSpeaker
          stageSpeaker.push(step.speech)
          await stageSpeaker.end()
          if (stale() || !guidedDemoSnapshot().active) return
          // Close lip-sync while the animation continues silently. The
          // next sentence reopens the SAME approved audio turn.
          portalSpeechEnd(turnId)
          if (!stageAudible) {
            console.warn('[lumia:ph046] Etapa sin audio audible, sin gesto:', index)
            continue
          }
          if (step.motionId) {
            const result = await waitForGuidedDemoClip(turnId, index)
            if (stale() || !guidedDemoSnapshot().active) return
            if (result.status !== 'finished') {
              console.warn('[lumia:ph046] Movimiento no completado:',
                step.motionId, result.status)
            }
          }
          // Give the viewer a moment to appreciate the finished action or
          // expression. This pause exists ONLY in the requested tutorial.
          const restMs = step.type === 'motion' ? 850
            : step.type === 'face' ? 1400
            : step.type === 'transition' ? 700 : 350
          await new Promise<void>((resolve) => setTimeout(resolve, restMs))
        }
      } else {
        await spk.end()
      }
      if (stale()) return
      if (!started && !text.trim()) {
        const note = 'El cerebro terminó sin generar texto de respuesta.'
        store.getState().updateTurn(turnId, {
          status: 'no-response', finishedAt: Date.now(), errorNote: note,
        })
        store.getState().setError(note)
      } else {
        store.getState().updateTurn(turnId, {
          status: 'complete', finishedAt: Date.now(),
        })
        sfx.play('done')
      }
    } catch (err) {
      if (stale()) return
      console.error(err)
      sfx.play('error')
      const failure = err instanceof Error ? err.message : 'Error desconocido.'
      store.getState().updateTurn(turnId, {
        status: 'error', finishedAt: Date.now(), errorNote: failure,
      })
      store.getState().setError(failure)
    } finally {
      if(activeVisualReply.current===turnId)activeVisualReply.current=null
      if (!stale()) {
        portalSpeechEnd(turnId)
        endGuidedDemo(turnId)
        if (activeReply.current === turnId) activeReply.current = null
        speaker.current = null
        sfx.duck(false)
        music.duck(false)
        store.getState().setActiveTool(null)
        music.working(false)

        // Do not flip straight from SPEAKING to LISTENING. Chrome can endpoint
        // and return the last words coming from the speakers up to roughly a
        // second later. If we were already in command mode by then, L.U.M.I.A.
        // would accept her own answer as a new user request and answer it again,
        // creating the visible/spoken repetition loop.
        const guardMs = followupGuardMs()
      voiceDiag.postSpeechGuardMs = guardMs
      await new Promise((r) => setTimeout(r, guardMs))

        // Continuous mode keeps the microphone open for conversational
        // follow-ups. Text and tap-to-talk return to standby without a mic.
        if (!stale()) {
          if (shouldRunAlwaysOnVoice(inputModeRef.current)) listen(FOLLOW_UP_MS)
          else store.getState().setPhase('dormant')
        }
      }
    }
  }

  // -- voice events ---------------------------------------------------------

  /** What the voice loop should do with what it hears, derived from phase. */
  const mode = (): VoiceMode =>
    experimentOwner.current || !shouldRunAlwaysOnVoice(inputModeRef.current)
      ? 'deaf' : voiceModeForPhase(store.getState().phase)

  const onWake = (trailing: string) => {
    if (experimentOwner.current) return
    const phase = store.getState().phase
    if (phase === 'offline' || phase === 'boot') return

    store.getState().setError(null)
    sfx.play('wake')

    // "Jarvis, what's happening in AI this week" in one breath. Waiting for a
    // greeting he didn't need is the most common way an assistant wastes time.
    if (trailing) {
      void respond(trailing)
      return
    }

    store.getState().setPhase('waking')

    // Answer to the wake name. A same-breath command ("Lumi, explícame...")
    // was already handled above through `trailing`. For a bare "Lumi", the
    // waking phase is deliberately GUARD so this acknowledgement cannot be
    // transcribed back as the user's next command.
    const greetId = 'greeting-' + newId()
    const greeting = createSpeaker(
      () => portalSpeechStart(greetId),
      (phrase) => portalSpeechPhrase(greetId, phrase.text),
    )
    speaker.current = greeting
    greeting.say(attention())

    // The browser recogniser can also hear this acknowledgement. Keep the
    // machine out of command mode until the greeting and its short echo tail
    // are finished, otherwise "Aquí estoy" can become the next command.
    void (async () => {
      await greeting.end()
      portalSpeechEnd(greetId)
      const guardMs = followupGuardMs()
      voiceDiag.postSpeechGuardMs = guardMs
      await new Promise((r) => setTimeout(r, guardMs))
      if (speaker.current === greeting) speaker.current = null
      const now = store.getState().phase
      if (now === 'waking' || now === 'speaking') listen(AWAIT_SPEECH_MS)
    })()
  }

  /**
   * Someone started talking. This is the whole point of the rewrite: he stops,
   * immediately, whatever he was doing.
   */
  const onSpeechStart = () => {
    if (experimentOwner.current) return
    const phase = store.getState().phase
    if (phase === 'listening' && ACTIVE_COMMAND_GRACE_ENABLED && voiceDiag.engine === 'whisper-local') {
      // One extension only, bounded from the beginning of listen().
      // Repeated noise/speech cannot renew the timeout indefinitely.
      if (!commandGraceUsed.current) {
        commandGraceUsed.current = true
        clearIdle()
        const startedAt = commandWindowStartedAt.current || Date.now()
        const remainingMs = Math.max(1, ACTIVE_COMMAND_GRACE_MS - (Date.now() - startedAt))
        scheduleCommandExpiry(remainingMs)
      }
      return
    }
    clearIdle()
    if (phase === 'offline' || phase === 'boot' || phase === 'dormant') return

    const wasBusy =
      phase === 'thinking' || phase === 'tooling' || phase === 'speaking'

    silence()
    if (wasBusy) {
      if (activeReply.current) {
        store.getState().updateTurn(activeReply.current, {
          status: 'interrupted', finishedAt: Date.now(),
        })
        activeReply.current = null
      }
      // Abandon the answer in flight. The turn counter moves in respond()'s
      // replacement; bumping it here covers the case where nothing replaces it.
      turn.current++
      interrupt()
      store.getState().setActiveTool(null)
      music.working(false)
      sfx.duck(false)
      music.duck(false)

      // A bare "Lumi" or "para" intentionally stops the answer but may not carry
      // a new command in the same breath. Keep a bounded listening window open.
      listen(AWAIT_SPEECH_MS)
      return
    }
    store.getState().setPhase('listening')
  }

  /** Only a confirmed, locally captured long COMMAND extends the 35s pilot
   * window; noise, WAKE, GUARD and repeated onset events cannot renew it. */
  const onLongSpeechSegment = () => {
    if (!LONG_QUESTION_INPUT_ENABLED || !ACTIVE_COMMAND_GRACE_ENABLED ||
        experimentOwner.current || voiceDiag.engine !== 'whisper-local' ||
        store.getState().phase !== 'listening' || !commandGraceUsed.current) return
    const remaining = remainingLongQuestionWindow(
      commandWindowStartedAt.current, Date.now(),
    )
    if (remaining <= 0) return
    clearIdle()
    scheduleCommandExpiry(remaining)
  }

  const onUtterance = (text: string) => {
    if (experimentOwner.current) return
    const phase = store.getState().phase
    if (phase === 'offline' || phase === 'boot' || phase === 'dormant') return

    // People keep using his name as a vocative once they're already talking to
    // him. Strip it rather than sending "jarvis" to the model as a question.
    if (BARE_NAME.test(text)) {
      listen(AWAIT_SPEECH_MS)
      return
    }
    const said = text.replace(LEADING_NAME, '').trim()
    if (!said) {
      listen(AWAIT_SPEECH_MS)
      return
    }

    void respond(said)
  }

  const onPartial = (text: string) => {
    if (experimentOwner.current) return
    store.getState().setCaption(text)
  }

  const onTranscript = (event: VoiceTranscriptEvent) => {
    if (experimentOwner.current) return
    store.getState().pushHeardLine({
      id: event.id,
      text: event.text,
      provider: event.provider,
      kind: event.kind,
      wakeMatched: event.wakeMatched,
      mode: event.capturedMode,
      at: event.at,
      sttMs: event.sttMs,
    })
  }

  const onVoiceError = (message: string) => {
    store.getState().setError(message)
  }

  const invalidateVoiceRestart = () => {
    voiceRestart.current += 1
  }

  const restartVoice = async () => {
    const generation = ++voiceRestart.current
    voice.current?.stop()
    voice.current = null
    if (experimentOwner.current || !shouldRunAlwaysOnVoice(inputModeRef.current)) return

    const next = await startVoice({
      mode,
      onWake,
      onSpeechStart,
      onLongSpeechSegment,
      onPartial,
      onTranscript,
      onUtterance,
      onError: onVoiceError,
    })

    if (generation !== voiceRestart.current || experimentOwner.current ||
        !shouldRunAlwaysOnVoice(inputModeRef.current)) {
      next.stop()
      return
    }

    voice.current = next
  }

  // -- power on -------------------------------------------------------------

  const powerOn = async () => {
    // The ignition button and the space bar can both land here, and the phase
    // only moves after the first await — so without this a double press boots
    // twice, arming two voice loops and two download polls.
    if (booting.current) return
    booting.current = true

    try {
      await ignite()
    } catch (err) {
      // The guard must not outlive a failed boot. Audio unlock can be refused,
      // the microphone prompt dismissed, the bridge unreachable at the wrong
      // moment — and with the flag still latched the ignition button was dead
      // for the rest of the page, recoverable only by reloading. Reset it and
      // put the button back so the user can simply press it again.
      booting.current = false
      console.error('[jarvis] power-up failed:', err)
      store.getState().setPhase('offline')
      store
        .getState()
        .setError(
          err instanceof Error
            ? `Power-up failed: ${err.message}`
            : 'Power-up failed. Click to try again.',
        )
    }
  }

  const ignite = async () => {
    const s = store.getState()

    // Must happen inside the click handler — browsers won't start an
    // AudioContext or speech synthesis without a user gesture.
    await sfx.unlockAudio()
    sfx.play('boot')
    // The score. Must be started from inside this click handler for the same
    // reason as the rest of the audio.
    music.enable()
    // The inherited boot-music track belongs to the original JARVIS presentation.
    // L.U.M.I.A. keeps the synthesised reactor cue + ambient bed, but does not
    // play that legacy intro before her own Spanish presentation.
    music.startAmbient()

    s.setPhase('boot')

    watchServers((servers) => store.getState().setConnected(servers))
    watchPanels((panel) => store.getState().pushPanel(panel))
    watchBlades((blade) => store.getState().pushBlade(blade))

    /**
     * JARVIS asking to see something.
     *
     * Announced on screen for as long as it takes, with whatever he said he was
     * looking for. The camera's own light is on too, but a hardware light that
     * appears with no explanation is exactly the thing that makes people
     * distrust an assistant — so the interface says it before they have to ask.
     */
    watchCapture(async (req) => {
      const note =
        req.mode === 'watch'
          ? req.when === 'past'
            ? req.reason || 'reviewing the last few seconds'
            : `${req.reason || 'watching'} · ${req.seconds}s`
          : req.reason || 'taking a look'
      store.getState().setLooking(note)

      // The past is only available if something has been remembering it, and
      // that only happens while the camera is on screen. Answering plainly
      // beats opening the camera and recording the next few seconds instead,
      // which is a different question from the one that was asked.
      if (req.mode === 'watch' && req.when === 'past' && camera.bufferedSeconds() < 1) {
        store.getState().setLooking(null)
        return {
          error:
            'There is no recent footage — the camera has to be open on screen ' +
            'for me to remember what just happened. Ask me to open the camera, ' +
            'and I can watch from then on.',
        }
      }

      // Held for the whole capture. Without this the stream can be torn down by
      // whoever else was using it half way through a six-second watch.
      let held = false
      try {
        await camera.holdCamera()
        held = true
        if (req.mode === 'look') return camera.grabFrame()
        if (req.when === 'past') {
          const grid = camera.recentGrid(req.seconds, 9)
          return grid ?? { error: 'There is not enough recent footage to review.' }
        }
        return await camera.watchAhead(req.seconds, 9)
      } catch (err) {
        return {
          error:
            (err as DOMException)?.name === 'NotAllowedError'
              ? 'The camera is not permitted, so I cannot see anything.'
              : `The camera could not be read: ${(err as Error)?.message ?? err}`,
        }
      } finally {
        if (held) camera.releaseCamera()
        store.getState().setLooking(null)
      }
    })

    // The interface is JARVIS's to drive. These arrive out of band, pushed
    // mid-turn the way panels are, so a command can retint the reactor or put
    // something into orbit while he is still speaking the sentence about it.
    watchUi((op, args) => {
      const s = store.getState()
      const a = (args ?? {}) as Record<string, never>
      switch (op) {
        case 'patch':
          s.applyUi(args)
          break
        case 'orbit':
          if (a.action === 'add') s.addOrbit(args)
          else if (a.action === 'remove') s.removeOrbit(String(a.id))
          else s.clearOrbits()
          break
        case 'effect':
          s.fireEffect(a.kind)
          break
        case 'reset':
          s.resetUi()
          break
        case 'screen':
          s.clearScreen(a.what ?? 'all')
          break
        default:
          console.warn('[jarvis] unknown ui op:', op, args)
      }
    })
    watchVoiceRuntime((runtime) => {
      const beforeStt = caps().voice?.effective?.effectiveStt
      applyVoiceRuntimeSnapshot(runtime)
      const afterStt = caps().voice?.effective?.effectiveStt

      store.getState().setVoice(currentVoiceName())

      // TTS changes are read lazily by createSpeaker and need no restart.
      // STT owns a long-lived recogniser/VAD loop, so replace only that loop
      // when its effective provider changes.
      const phase = store.getState().phase
      if (
        beforeStt !== afterStt &&
        phase !== 'offline' &&
        phase !== 'boot'
      ) {
        void restartVoice()
      }
    })
    // In bridge mode the conversation lives in the agent session, which is tied
    // to the socket — so a drop silently wipes his memory while the transcript
    // on screen still shows it. Better to say so than to let him quietly forget.
    watchConnection((state) => {
      if (state === 'lost') {
        store.getState().setError('Bridge connection lost — reconnecting.')
      } else if (state === 'reconnected') {
        store
          .getState()
          .setError('Bridge reconnected. The previous conversation was not kept.')
      }
    })
    const warming = warm().catch((err: Error) => s.setError(err.message))

    if (!usingBridge && !env.anthropicKey) {
      s.setError(
        'No Anthropic API key — copy .env.example to .env.local and set VITE_ANTHROPIC_API_KEY.',
      )
    }

    // Pull the neural voice down during the boot sequence so the first
    // "Hey Jarvis" isn't waiting on an 86MB download. Deliberately not awaited
    // — if it's slow, JARVIS comes up on the system voice and swaps over the
    // moment the model is ready.
    if (TTS_ENGINE === 'kokoro') {
      void kokoro.load()
      voicePoll.current = setInterval(() => {
        const p = kokoro.loadProgress()
        if (kokoro.isReady() || kokoro.isUnavailable()) {
          store.getState().setBootNote('')
          if (voicePoll.current) clearInterval(voicePoll.current)
          voicePoll.current = null
        } else if (p > 0 && p < 1) {
          store.getState().setBootNote(`voice ${Math.round(p * 100)}%`)
        }
      }, 200)
    }

    // Long enough for the four-beat start-up sequence in Boot.tsx to play —
    // status bar, rings, suit schematic, reactor power-up — before the live
    // interface takes over. Kept a touch under the boot cue so the music is
    // still rising as the reactor lands.
    await new Promise((r) => setTimeout(r, 9200)) // boot sequence
    await warming
    store.getState().setConnected(connectedLabels())
    store.getState().setVoice(currentVoiceName())

    // The analyser is what makes the reactor pulse with your voice. It needs a
    // getUserMedia stream; speech recognition does not, and gets its own. So a
    // failure here costs the animation and nothing else — saying "voice input
    // is unavailable" was both alarming and untrue.
    if (shouldRunAlwaysOnVoice(inputModeRef.current)) {
      try {
        await startAnalyser()
      } catch {
        console.warn('[lumia] microphone analyser unavailable; text remains usable.')
      }
    }

    // Ask the bridge which speech engines exist before the loop starts, so the
    // first spoken line already uses the best available Spanish voice.
    await probeCapabilities()
    // The footer was initialized before the VRM probe and could incorrectly
    // keep showing Windows system voice (e.g. Microsoft Helena) while local
    // Kokoro was already the effective synthesizer. Sync the actual engine
    // label after capability detection; no model/voice preference is changed.
    store.getState().setVoice(currentVoiceName())

    // L.U.M.I.A.'s introduction happens before the recogniser starts. This is
    // deliberate: the assistant says her own wake word ("Lumi"), and starting
    // SpeechRecognition first would let the microphone wake on her greeting.
    store.getState().setPhase('speaking')
    const introId = 'intro-' + newId()
    const intro = createSpeaker(
      () => portalSpeechStart(introId),
      (phrase) => portalSpeechPhrase(introId, phrase.text),
    )
    speaker.current = intro
    intro.say(
      'Hola. Soy Lumia, la asistente inteligente principal de Orbia. Puedes llamarme Lumi. Estoy lista.',
    )
    await intro.end()
    portalSpeechEnd(introId)
    speaker.current = null

    // Only the explicitly selected continuous mode opens local STT.
    // Native text mode boots without requiring getUserMedia permission.
    if (shouldRunAlwaysOnVoice(inputModeRef.current)) await restartVoice()

    store.getState().setPhase('dormant')
  }

  // -- clap to start --------------------------------------------------------

  /**
   * A clap brings him up, as an alternative to the button.
   *
   * Only while the ignition screen is showing, and torn down the moment he
   * boots — the microphone is about to belong to the voice loop, and two
   * analysers arguing over the same stream is how you get an assistant that
   * hears half of what you say.
   *
   * Deliberately silent about failure. If the microphone is refused, or has not
   * been granted yet, the button is still right there; announcing an error
   * about a feature nobody asked for would be worse than quietly doing without.
   */
  useEffect(() => {
    if (phase !== 'offline') return
    if (MULTIMODAL_COMPOSER && import.meta.env.VITE_LUMIA_CLAP_BOOT !== '1') return
    let live: { stop: () => void } | null = null
    let gone = false
    void listenForClap(() => {
      if (!gone) void powerOn()
    }).then((l) => {
      if (gone) l.stop()
      else live = l
    })
    return () => {
      gone = true
      live?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // -- level pump + keys ----------------------------------------------------

  useEffect(() => {
    let raf = 0

    const pump = () => {
      const st = store.getState()
      // While speaking, follow JARVIS's own output rather than the mic, so the
      // orb lip-syncs instead of reacting to room noise.
      const lvl =
        st.phase === 'speaking' && speaker.current
          ? speaker.current.level()
          : micLevel()
      st.setLevel(lvl)
      raf = requestAnimationFrame(pump)
    }
    pump()

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      // Global shortcuts remain installed while a voice lab owns the mic.
      // They must never start turns or speak over the test's acoustic output.
      if (experimentOwner.current) {
        if (e.key === 'Escape' || e.code === 'Space') e.preventDefault()
        return
      }

      // V auditions the next British voice installed on this machine. Which
      // ones exist varies per Mac, so hearing them beats trusting a ranking.
      // Bare V only — ⌘V and ⌃V are paste, and swallowing those was rude.
      if (
        e.key === 'v' &&
        !e.repeat &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault()
        const name = cycleVoice()
        store.getState().setVoice(name)
        silence()
        const demo = createSpeaker()
        speaker.current = demo
        demo.say(`Voz configurada como ${name.replace(/\(.*?\)/g, '').trim()}. A su servicio, señor.`)
        void demo.end()
        return
      }

      // G puts the camera on and starts tracking hands. Off by default and
      // never implicit: a webcam that turns itself on because an interface
      // thought it might be useful is not a trade anyone agreed to.
      if (e.key === 'g' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        const on = store.getState().gestures
        if (on) {
          hands.disableHands()
          store.getState().setGestures(false)
        } else {
          store.getState().setError(null)
          void hands
            .enableHands()
            .then(() => store.getState().setGestures(true))
            .catch((err: Error) => {
              store.getState().setGestures(false)
              store
                .getState()
                .setError(
                  err?.name === 'NotAllowedError'
                    ? 'Camera access denied — gesture control is unavailable.'
                    : `Gesture control failed to start: ${err?.message ?? err}`,
                )
            })
        }
        return
      }

      // T speaks a fixed line, bypassing the wake word, the recogniser and the
      // model entirely. When "I can't hear him" is the report, this is the one
      // keypress that separates a broken voice engine from a broken voice loop
      // — and it prints the verdict rather than making you infer it.
      if (e.key === 't' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        silence()
        const t = createSpeaker()
        speaker.current = t
        t.say('Prueba de audio. Si puede escuchar esto, la salida de voz está funcionando, señor.')
        void t.end().then(() => {
          const d = (window as unknown as Record<string, Record<string, unknown>>).__tts
          console.info('[jarvis] audio test →', d)
          if (d && d.started === 0 && d.rescued === 0) {
            store.getState().setError(
              `No sound produced. engine=${d.engine} voice=${d.voice} error=${d.lastError || 'none'}`,
            )
          }
        })
        return
      }

      // Escape stands the whole thing down — the one thing the old build had
      // no key for at all.
      if (e.key === 'Escape') {
        e.preventDefault()
        if (pushCapture.current) {
          pushGeneration.current++
          pushCapture.current.cancel()
          pushCapture.current = null
          if (pushTimer.current) clearTimeout(pushTimer.current)
          pushTimer.current = null
          setPushRecording(false)
          setPushBusy(false)
          releaseMicrophone()
        }
        if (store.getState().phase !== 'offline') goDormant()
        return
      }

      // Space starts a turn without the wake word. Worth using while filming so
      // a missed wake word doesn't cost a take.
      if (e.code !== 'Space' || e.repeat) return
      if (MULTIMODAL_COMPOSER && inputModeRef.current !== 'continuous' &&
          store.getState().phase !== 'offline') return
      e.preventDefault()

      const phase = store.getState().phase
      if (phase === 'offline') {
        void powerOn()
      } else if (phase === 'boot') {
        /* ignore — the boot sequence owns the phase until it finishes */
      } else if (
        phase === 'thinking' ||
        phase === 'tooling' ||
        phase === 'speaking'
      ) {
        onSpeechStart()
        listen(AWAIT_SPEECH_MS)
      } else {
        onWake('')
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      clearIdle()
      if (voicePoll.current) clearInterval(voicePoll.current)
      invalidateVoiceRestart()
      voice.current?.stop()
      pushGeneration.current++
      if (pushTimer.current) clearTimeout(pushTimer.current)
      pushCapture.current?.cancel()
      pushCapture.current = null
      releaseMicrophone()
      speaker.current?.cancel()
      // The camera must not outlive the page that turned it on.
      hands.disableHands()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Input modes are independent of LUMIA's response voice; typing works
   * even while CONTINUOUS is selected. Only a user gesture opens PUSH audio. */
  const switchInputMode = (next: LumiaInputMode) => {
    if (experimentOwner.current || store.getState().phase === 'boot' ||
        store.getState().phase === 'offline') return
    if (inputModeRef.current === next) return
    inputModeRef.current = next
    setInputMode(next)
    pushGeneration.current++
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = null
    pushCapture.current?.cancel()
    pushCapture.current = null
    setPushRecording(false)
    setPushBusy(false)
    clearIdle()
    invalidateVoiceRestart()
    voice.current?.stop()
    voice.current = null
    releaseMicrophone()
    if (store.getState().phase === 'listening') goDormant()
    if (next === 'continuous') {
      void startAnalyser().catch(() => {})
      void restartVoice().catch((err: unknown) => {
        store.getState().setError(
          err instanceof Error ? err.message : 'No se pudo iniciar la escucha continua.',
        )
      })
    }
  }

  /** LT-01 uses a separate Ollama-only endpoint and never changes Whisper,
   * chat history or Spanish Kokoro. Audio translation is a later pilot. */
  const translateWritten = (text: string, source: TranslationLanguage, target: TranslationLanguage) => {
    if (experimentOwner.current || !usingBridge) return
    const phase = store.getState().phase
    if (phase === 'offline' || phase === 'boot') return
    clearIdle()
    silence()
    interrupt()
    const mine = ++turn.current
    const previous = activeReply.current
    if (previous) store.getState().updateTurn(previous, {
      status: 'interrupted', finishedAt: Date.now(),
    })
    const s = store.getState()
    s.setError(null)
    const acceptedAt = Date.now()
    s.pushTurn({ id: newId(), role: 'user', text, at: acceptedAt })
    const responseId = newId()
    activeReply.current = responseId
    s.pushTurn({
      id: responseId, role: 'jarvis', text: '', at: acceptedAt, status: 'pending',
    })
    s.setPhase('thinking')
    void (async () => {
      try {
        const translation = await translateLocalText(text, source, target)
        if (turn.current !== mine) return
        const targetName = target === 'es' ? 'español' : target === 'en' ? 'inglés' : 'chino mandarín'
        s.updateTurn(responseId, {
          text: 'Traducción al ' + targetName + ': ' + translation,
          status: 'complete', firstTextAt: Date.now(), finishedAt: Date.now(),
        })
      } catch (err) {
        if (turn.current !== mine) return
        const message = err instanceof Error ? err.message : 'Falló la traducción local.'
        s.updateTurn(responseId, {
          status: 'error', errorNote: message, finishedAt: Date.now(),
        })
        s.setError(message)
      } finally {
        if (turn.current === mine) {
          activeReply.current = null
          s.setPhase('dormant')
        }
      }
    })()
  }

  /** LT-05: private file translation; manual source language (not wake STT).
   * Show BOTH original transcript and translated text on the existing HUD. */
  const translateAudioNote = async (
    file: File, source: TranslationLanguage, target: TranslationLanguage,
  ): Promise<void> => {
    if (experimentOwner.current || !usingBridge) throw new Error('Traductor local no disponible.')
    if (['offline', 'boot'].includes(store.getState().phase))
      throw new Error('Enciende LUMIA antes de traducir el audio.')
    clearIdle()
    silence()
    interrupt()
    const mine=++turn.current
    const previous=activeReply.current
    if(previous) store.getState().updateTurn(previous,{
      status:'interrupted',finishedAt:Date.now(),
    })
    const s=store.getState()
    s.setError(null)
    const acceptedAt=Date.now()
    const languageName=(code:TranslationLanguage) =>
      code==='es' ? 'español' : code==='en' ? 'inglés' : 'mandarín'
    s.pushTurn({
      id:newId(), role:'user',at:acceptedAt,
      text:'Audio adjunto para traducir: '+languageName(source)+' → '+languageName(target),
    })
    const responseId=newId()
    activeReply.current=responseId
    s.pushTurn({id:responseId,role:'jarvis',text:'',at:acceptedAt,status:'pending'})
    s.setPhase('thinking')
    try {
      const result=await translateLocalAudioFile(file,source,target)
      if(turn.current!==mine) return
      s.updateTurn(responseId,{
        text:'Transcripción original ('+languageName(source)+'):\n'+
          result.originalText+'\n\nTraducción al '+languageName(target)+':\n'+result.translation,
        status:'complete',firstTextAt:Date.now(),finishedAt:Date.now(),
      })
    } catch(err) {
      if(turn.current!==mine) return
      const note=err instanceof Error ? err.message : 'Falló la traducción del audio.'
      const transcript=err instanceof AudioTranslationError ? err.originalText : undefined
      s.updateTurn(responseId,{
        text:transcript ? 'Transcripción original ('+languageName(source)+'):\n'+transcript : '',
        status:'error',errorNote:note,finishedAt:Date.now(),
      })
      s.setError(note)
      throw err
    } finally {
      if(turn.current===mine) {
        activeReply.current=null
        s.setPhase('dormant')
      }
    }
  }

  // VISION-02.1: opening the camera is only a *preview*, not an AI request.
  // The owner can align a label or face and then deliberately analyze a
  // single frame. Camera remains local and has a 90-second preview expiry.
  const submitCamera = () => {
    if(!CAMERA_VISION_VI02_ENABLED || cameraCapturing || experimentOwner.current)return
    if(store.getState().phase==='offline'||store.getState().phase==='boot')return
    if(cameraPreviewOpen){
      closeCameraViewfinder()
      return
    }
    visualSession.current.clear()
    setVisionContextReady(false)
    setCameraStill(null)
    setCameraPreviewOpen(true)
  }
  const closeCameraViewfinder = () => {
    // Closing the viewer discards the image and revokes visual follow-ups.
    // If Qwen is still using that image, interrupt that visual reply too.
    if(activeVisualReply.current){
      silence()
      turn.current++
      interrupt()
      if(activeReply.current===activeVisualReply.current){
        store.getState().updateTurn(activeReply.current,{
          status:'interrupted',finishedAt:Date.now(),
        })
        activeReply.current=null
      }
      activeVisualReply.current=null
      store.getState().setActiveTool(null)
      store.getState().setPhase('dormant')
      sfx.duck(false)
      music.duck(false)
      music.working(false)
    }
    visualSession.current.clear()
    setVisionContextReady(false)
    setCameraPreviewOpen(false)
    setCameraStill(null)
  }
  const recaptureCameraViewfinder = () => {
    if(!CAMERA_VISION_VI02_ENABLED || cameraCapturing || experimentOwner.current)return
    visualSession.current.clear()
    setVisionContextReady(false)
    setCameraStill(null)
    setCameraPreviewOpen(true)
  }
  const analyzeCameraViewfinderFrame = (image:LocalVisualImage) => {
    // LumiaCameraViewfinder releases the live webcam lease synchronously
    // BEFORE notifying us with these exact JPEG bytes.
    setCameraPreviewOpen(false)
    setCameraStill(image)
    silence()
    interrupt()
    void respond('Lumi, describe exactamente lo que aparece en esta imagen y dime qué no puedes distinguir.',image,false,true)
  }

  const submitVisualFollowUp = (text:string) => {
    if(experimentOwner.current || !visualSession.current.hasAnalyzedFrame())return
    if(store.getState().phase==='offline'||store.getState().phase==='boot')return
    silence()
    interrupt()
    void respond(text,undefined,false,false,true)
  }

  const submitWritten = (text: string, image?: LocalVisualImage) => {
    if (experimentOwner.current) return
    const phase = store.getState().phase
    if (phase === 'offline' || phase === 'boot') return
    silence()
    interrupt()
    void respond(text, image)
  }

  const stopPush = async () => {
    const capture = pushCapture.current
    if (!capture || inputModeRef.current !== 'push') return
    const generation = pushGeneration.current
    pushCapture.current = null
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = null
    setPushRecording(false)
    setPushBusy(true)
    try {
      const blob = await capture.stop()
      if (generation === pushGeneration.current && inputModeRef.current === 'push') {
        releaseMicrophone()
      }
      const wav = await audioBlobToPcmWav(blob)
      const res = await fetch(`${BRIDGE_HTTP_URL}/stt/local`, {
        method: 'POST',
        headers: { 'content-type': 'audio/wav', 'x-orbia-voice-mode': 'command' },
        body: wav,
      })
      if (!res.ok) throw new Error(`Whisper local no respondió (HTTP ${res.status}).`)
      const result = await res.json() as { text?: string }
      if (pushGeneration.current !== generation || inputModeRef.current !== 'push') return
      const said = (result.text ?? '').trim()
      if (!said) throw new Error('Whisper no identificó palabras. Prueba de nuevo.')
      store.getState().pushHeardLine({
        id: newId(), text: said, provider: 'whisper-local',
        kind: 'speech', wakeMatched: false, mode: 'command', at: Date.now(),
      })
      submitWritten(said)
      // A single dictated message returns to the compact text dock.
      switchInputMode('text')
    } catch (err) {
      if (generation === pushGeneration.current) {
        store.getState().setError(err instanceof Error ? err.message : 'Falló el dictado local.')
      }
    } finally {
      if (generation === pushGeneration.current && inputModeRef.current === 'push') {
        releaseMicrophone()
        setPushBusy(false)
      }
    }
  }

  const startPush = async () => {
    if (inputModeRef.current !== 'push' || experimentOwner.current ||
        pushCapture.current || pushBusy) return
    const generation = ++pushGeneration.current
    setPushBusy(true)
    try {
      const capture = await startPushCapture()
      if (inputModeRef.current !== 'push' || generation !== pushGeneration.current) {
        // Mode switching already released the old microphone lease. Never
        // tear down a newer CONTINUOUS lease from a stale permission callback.
        capture.cancel()
        return
      }
      pushCapture.current = capture
      setPushRecording(true)
      pushTimer.current = setTimeout(() => { void stopPush() }, PUSH_CAPTURE_MAX_MS)
    } catch (err) {
      if (generation === pushGeneration.current && inputModeRef.current === 'push') {
        releaseMicrophone()
        store.getState().setError(err instanceof Error ? err.message : 'No se pudo abrir el micrófono.')
      }
    } finally {
      if (generation === pushGeneration.current) setPushBusy(false)
    }
  }

  const cancelPush = () => {
    pushGeneration.current++
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = null
    pushCapture.current?.cancel()
    pushCapture.current = null
    setPushRecording(false)
    setPushBusy(false)
    if (inputModeRef.current === 'push') releaseMicrophone()
  }

  const suspendForExperiment = (owner: 'realtime' | 'acoustic'): boolean => {
    if (experimentOwner.current) return false
    experimentOwner.current = owner
    setActiveExperiment(owner)
    clearIdle()
    invalidateVoiceRestart()
    voice.current?.stop()
    voice.current = null
    silence()
    turn.current++
    interrupt()
    music.working(false)
    music.duck(false)
    sfx.duck(false)
    store.getState().setPhase('thinking')
    return true
  }

  const resumeFromExperiment = (owner: 'realtime' | 'acoustic'): void => {
    if (experimentOwner.current !== owner) return
    // Release ownership before restarting; generation mismatches will reject
    // any recognizer packets emitted from an older suspended voice instance.
    experimentOwner.current = null
    setActiveExperiment(null)
    goDormant()
    void restartVoice().catch((err: unknown) => {
      store.getState().setError(
        err instanceof Error ? err.message : 'No se pudo recuperar el reconocimiento local.',
      )
    })
  }

  return (
    <>
      <Scene />
      {AVATAR_PH04_ENABLED && <LumiaDemoIndicator onStop={() => {
        if (activeReply.current) {
          store.getState().updateTurn(activeReply.current, {status: 'interrupted', finishedAt: Date.now()})
          activeReply.current = null
        }
        goDormant()
      }} />}
      <Hud />
      {CAMERA_VISION_VI02_ENABLED && (cameraPreviewOpen || cameraStill) && (
        <LumiaCameraViewfinder
          live={cameraPreviewOpen}
          still={cameraStill}
          onCaptured={analyzeCameraViewfinderFrame}
          onClose={closeCameraViewfinder}
          onReopen={recaptureCameraViewfinder}
          visualContextReady={visionContextReady}
          visualReplyMode={visionReplyMode}
          onVisualReplyModeChange={setVisionReplyMode}
          onAskAboutStill={submitVisualFollowUp}
        />
      )}
      <Boot />
      <Diagnostics />
      {MULTIMODAL_COMPOSER ? (
        <LumiaComposer
          available={phase !== 'offline' && phase !== 'boot' && !activeExperiment}
          mode={inputMode}
          recording={pushRecording}
          busy={pushBusy}
          visionAvailable={usingBridge && import.meta.env.VITE_LUMIA_VISUAL_INPUT_VI01 === '1'}
          cameraAvailable={CAMERA_VISION_VI02_ENABLED}
          cameraCapturing={cameraCapturing}
          cameraPreviewOpen={cameraPreviewOpen}
          onCaptureCamera={submitCamera}
          translationAvailable={usingBridge && import.meta.env.VITE_LUMIA_TRANSLATE_LT01 === '1'}
          avatarViewControl={AVATAR_PH04_ENABLED}
          onTranslate={translateWritten}
          onTranslateAudio={translateAudioNote}
          onModeChange={switchInputMode}
          onSend={submitWritten}
          onStartRecording={() => { void startPush() }}
          onStopRecording={() => { void stopPush() }}
          onCancelRecording={cancelPush}
        />
      ) : import.meta.env.VITE_LUMIA_VISUAL_INPUT_VI01 === '1' && usingBridge && (
        <VisualInput
          available={phase !== 'offline' && phase !== 'boot'}
          onAnalyze={(prompt, image) => respond(prompt, image)}
        />
      )}
      {import.meta.env.VITE_LUMIA_ACOUSTIC_LAB === '1' && (
        <AcousticLab
          available={phase !== 'offline' && phase !== 'boot' &&
            (activeExperiment === null || activeExperiment === 'acoustic')}
          onSuspendNormal={() => suspendForExperiment('acoustic')}
          onResumeNormal={() => resumeFromExperiment('acoustic')}
        />
      )}
      {isRealtimePilotUiEnabled() && (
        <RealtimeTrial
          available={phase !== 'offline' && phase !== 'boot' &&
            (activeExperiment === null || activeExperiment === 'realtime')}
          onSuspendNormal={() => suspendForExperiment('realtime')}
          onResumeNormal={() => resumeFromExperiment('realtime')}
        />
      )}
      <Ignition onStart={() => void powerOn()} />
    </>
  )
}
