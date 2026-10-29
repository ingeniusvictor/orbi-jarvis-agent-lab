import { useEffect, useState } from 'react'
import { useStore } from '../store'

/**
 * The "why can't he hear me / why can't I hear him" panel.
 *
 * Both halves of the voice loop fail silently by nature. Speech recognition
 * that ignores you and speech synthesis that produces no sound look identical
 * from the outside — nothing throws, nothing logs, the interface carries on as
 * though it were working. Every bug in this loop has therefore cost a round
 * trip of guesswork, and that is the actual problem this fixes: it is not a
 * developer toy, it is the instrument that turns "it doesn't work" into a
 * specific, answerable fact.
 *
 * Press D to show it. It polls rather than subscribing, because the two
 * diagnostic records are plain mutable objects written from outside React —
 * that is deliberate, since the whole point is to observe the loop without
 * changing its timing.
 */

type VoiceDiag = {
  running: boolean
  sessions: number
  heard: string
  heardAt: number
  lastError: string
  wakes: number
  mode: string
  dropped: string
  accepted: number
  restarts: number
  staleSegments: number
  householdIgnored: number
  selfEchoes: number
  speakerShield: boolean
  nonSpeech: number
  duplicates: number
  queueDepth: number
  maxQueueDepth: number
  queueDrops: number
  idleMs: number
  engine: string
  sttRoundTripMs: number | null
  assemblyHoldMs: number | null
  postSpeechGuardMs: number
  adaptiveTurnsEnabled: boolean
  acousticWindowMs: number
  turnHoldReason: string
  longQuestionOptIn: boolean
  longQuestionActive: boolean
  longQuestionParts: number
  nearFieldFocus: boolean
  microphoneAgcActual: boolean | null
  microphoneRms: number
  noiseFloorRms: number
  triggerRms: number
}

type TtsDiag = {
  engine: string
  spoken: number
  started: number
  failures: number
  lastError: string
  nativeBroken: boolean
  rescued: number
  voice: string
  lastText: string
  firstTextMs: number | null
  firstAudioMs: number | null
  streamOptIn: boolean
  transport: string
  streamChunks: number
  streamFailures: number
  localPlaybackRecovery: boolean
  localPlaybackStartTimeouts: number
  localPlaybackStalls: number
  localPlaybackFallbacks: number
  localSynthesisMs: number | null
  localSynthesisCount: number
  firstPhraseFastOptIn: boolean
  firstPhraseChars: number | null
  firstPhraseQueuedMs: number | null
  firstPhraseSynthesisMs: number | null
  firstPhrasePlaybackWaitMs: number | null
  firstPhraseStartedMs: number | null
  lastInterPhraseSilenceMs: number | null
  maxInterPhraseSilenceMs: number
  lastGapWaitingTextMs: number | null
  lastGapWaitingAudioMs: number | null
  lastGapPlaybackMs: number | null
}

const ago = (t: number) => (t ? `${((Date.now() - t) / 1000).toFixed(1)}s ago` : '—')

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="diag-row">
      <span className="diag-k">{k}</span>
      <span className={bad ? 'diag-v diag-bad' : 'diag-v'}>{v}</span>
    </div>
  )
}

export function Diagnostics() {
  const [open, setOpen] = useState(false)
  const [, tick] = useState(0)
  const phase = useStore((s) => s.phase)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'd' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [open])

  if (!open) return null

  const w = window as unknown as Record<string, unknown>
  const v = (w.__voice ?? {}) as Partial<VoiceDiag>
  const t = (w.__tts ?? {}) as Partial<TtsDiag>

  // The two verdicts worth stating outright, rather than making you infer them
  // from the numbers underneath.
  const earsOk = Boolean(v.running) && (v.accepted ?? 0) > 0
  const mouthOk = (t.started ?? 0) > 0 || (t.rescued ?? 0) > 0

  return (
    <div className="diag" aria-live="polite">
      <div className="diag-head">DIAGNOSTICS · D to close</div>

      <div className="diag-verdict">
        <span className={earsOk ? 'diag-ok' : 'diag-bad'}>
          {earsOk ? '● hearing you' : '● not hearing you'}
        </span>
        <span className={mouthOk ? 'diag-ok' : 'diag-bad'}>
          {mouthOk ? '● speaking' : '● no sound produced'}
        </span>
      </div>

      <div className="diag-sec">LISTENING</div>
      <Row k="recogniser" v={v.running ? 'running' : 'STOPPED'} bad={!v.running} />
      <Row k="sessions" v={String(v.sessions ?? 0)} />
      <Row
        k="silent for"
        v={`${((v.idleMs ?? 0) / 1000).toFixed(1)}s`}
        bad={(v.idleMs ?? 0) > 15000}
      />
      <Row k="forced restarts" v={String(v.restarts ?? 0)} bad={(v.restarts ?? 0) > 0} />
      <Row k="stale segments" v={String(v.staleSegments ?? 0)} />
      <Row k="household ignored" v={String(v.householdIgnored ?? 0)} />
      <Row k="LUMIA self-echo" v={String(v.selfEchoes ?? 0)} />
      <Row k="speaker shield" v={v.speakerShield ? 'ACTIVE' : 'standby'} />
      <Row k="near-field mic focus" v={v.nearFieldFocus ? 'ON · ASUS pilot' : 'OFF · legacy'} />
      <Row k="mic auto gain (actual)" v={v.microphoneAgcActual == null ? 'not exposed by browser' : v.microphoneAgcActual ? 'ON' : 'OFF'} />
      <Row k="mic RMS / ambient / trigger"
        v={`${(v.microphoneRms ?? 0).toFixed(4)} / ${(v.noiseFloorRms ?? 0).toFixed(4)} / ${(v.triggerRms ?? 0).toFixed(4)}`} />
      <Row k="non-speech ignored" v={String(v.nonSpeech ?? 0)} />
      <Row k="duplicate STT" v={String(v.duplicates ?? 0)} />
      <Row k="STT queue" v={`${v.queueDepth ?? 0} (max ${v.maxQueueDepth ?? 0})`} bad={(v.queueDepth ?? 0) > 2} />
      <Row k="queue drops" v={String(v.queueDrops ?? 0)} />
      <Row k="STT provider" v={String(v.engine ?? 'browser')} />
      <Row
        k="STT conversion + request"
        v={v.sttRoundTripMs == null ? 'browser-managed / unavailable' : `${v.sttRoundTripMs} ms`}
        bad={v.sttRoundTripMs != null && v.sttRoundTripMs > 3000}
      />
      <Row
        k="assembly hold (observed)"
        v={v.assemblyHoldMs == null ? '—' : `${v.assemblyHoldMs} ms`}
        bad={v.assemblyHoldMs != null && v.assemblyHoldMs > 1500}
      />
      <Row k="post-speech echo guard" v={`${v.postSpeechGuardMs ?? 2600} ms`} />
      <Row k="adaptive turn policy" v={v.adaptiveTurnsEnabled ? 'ON · experimental' : 'OFF · legacy'} />
      <Row k="last VAD silence window" v={`${v.acousticWindowMs ?? 650} ms`} />
      <Row k="last turn decision" v={String(v.turnHoldReason ?? 'baseline')} />
      <Row k="long question reception" v={v.longQuestionOptIn ? 'ON · ASUS pilot' : 'OFF · legacy'} />
      <Row k="long question assembling" v={v.longQuestionActive ? 'ACTIVE' : 'standby'} />
      <Row k="local command segments" v={String(v.longQuestionParts ?? 0)} />
      <Row k="mode" v={`${v.mode ?? '—'} (phase ${phase})`} />
      <Row k="accepted" v={String(v.accepted ?? 0)} bad={(v.accepted ?? 0) === 0} />
      <Row k="wakes" v={String(v.wakes ?? 0)} />
      <Row k="last heard" v={v.heard ? `"${v.heard}" ${ago(v.heardAt ?? 0)}` : '— nothing yet'} bad={!v.heard} />
      <Row k="last drop" v={v.dropped || '—'} bad={Boolean(v.dropped)} />
      <Row k="error" v={v.lastError || '—'} bad={Boolean(v.lastError)} />

      <div className="diag-sec">SPEAKING · press T to test</div>
      <Row k="engine" v={String(t.engine ?? 'system')} />
      <Row k="voice" v={String(t.voice || '—')} />
      <Row k="first model text" v={t.firstTextMs == null ? '—' : `${t.firstTextMs} ms`} />
      <Row k="first audible word" v={t.firstAudioMs == null ? '—' : `${t.firstAudioMs} ms`} />
      <Row k="fast local first chunk" v={t.firstPhraseFastOptIn ? 'ON · ASUS pilot' : 'OFF · legacy'} />
      <Row k="first phrase characters" v={t.firstPhraseChars == null ? '—' : String(t.firstPhraseChars)} />
      <Row k="first phrase queued" v={t.firstPhraseQueuedMs == null ? '—' : `${t.firstPhraseQueuedMs} ms from speaker creation`} />
      <Row k="first phrase TTS + WAV" v={t.firstPhraseSynthesisMs == null ? '—' : `${t.firstPhraseSynthesisMs} ms`} bad={(t.firstPhraseSynthesisMs ?? 0) > 4000} />
      <Row k="first phrase browser start" v={t.firstPhrasePlaybackWaitMs == null ? '—' : `${t.firstPhrasePlaybackWaitMs} ms`} bad={(t.firstPhrasePlaybackWaitMs ?? 0) > 1500} />
      <Row k="first phrase playback total" v={t.firstPhraseStartedMs == null ? '—' : `${t.firstPhraseStartedMs} ms`} />
      <Row k="cloud audio streaming" v={t.streamOptIn ? 'ON · experimental' : 'OFF · legacy'} />
      <Row k="audio transport" v={String(t.transport ?? 'buffered')} />
      <Row k="MP3 stream chunks" v={String(t.streamChunks ?? 0)} />
      <Row k="MP3 stream failures" v={String(t.streamFailures ?? 0)} bad={(t.streamFailures ?? 0) > 0} />
      <Row k="local WAV recovery" v={t.localPlaybackRecovery ? 'ON · ASUS pilot' : 'OFF · legacy'} />
      <Row k="local WAV start timeouts" v={String(t.localPlaybackStartTimeouts ?? 0)} bad={(t.localPlaybackStartTimeouts ?? 0) > 0} />
      <Row k="local WAV playback stalls" v={String(t.localPlaybackStalls ?? 0)} bad={(t.localPlaybackStalls ?? 0) > 0} />
      <Row k="offline WAV fallbacks" v={String(t.localPlaybackFallbacks ?? 0)} bad={(t.localPlaybackFallbacks ?? 0) > 0} />
      <Row k="Kokoro last phrase synthesis" v={t.localSynthesisMs == null ? '—' : `${t.localSynthesisMs} ms`} bad={(t.localSynthesisMs ?? 0) > 5000} />
      <Row k="Kokoro phrases synthesized" v={String(t.localSynthesisCount ?? 0)} />
      <Row k="last audible gap between phrases" v={t.lastInterPhraseSilenceMs == null ? '—' : `${t.lastInterPhraseSilenceMs} ms`} bad={(t.lastInterPhraseSilenceMs ?? 0) > 3000} />
      <Row k="maximum audible phrase gap" v={`${t.maxInterPhraseSilenceMs ?? 0} ms`} bad={(t.maxInterPhraseSilenceMs ?? 0) > 3000} />
      <Row k="gap — waiting model words" v={t.lastGapWaitingTextMs == null ? '—' : `${t.lastGapWaitingTextMs} ms`} bad={(t.lastGapWaitingTextMs ?? 0) > 2000} />
      <Row k="gap — Kokoro WAV preparation" v={t.lastGapWaitingAudioMs == null ? '—' : `${t.lastGapWaitingAudioMs} ms`} bad={(t.lastGapWaitingAudioMs ?? 0) > 2000} />
      <Row k="gap — browser playback" v={t.lastGapPlaybackMs == null ? '—' : `${t.lastGapPlaybackMs} ms`} bad={(t.lastGapPlaybackMs ?? 0) > 2000} />
      <Row k="handed to OS" v={String(t.spoken ?? 0)} />
      <Row k="actually spoke" v={String(t.started ?? 0)} bad={(t.started ?? 0) === 0} />
      <Row k="failures" v={String(t.failures ?? 0)} bad={(t.failures ?? 0) > 0} />
      <Row k="cloud rescues" v={String(t.rescued ?? 0)} />
      <Row k="error" v={t.lastError || '—'} bad={Boolean(t.lastError)} />
    </div>
  )
}
