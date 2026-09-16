import { BRIDGE_HTTP_URL, SPEECH_LANG } from '../config'
import { getMic } from './audio'
import {
  speakingEchoReference,
  speakingNow,
  speakingSince,
} from './tts'
import { startVad, type Vad } from './vad'
import { caps } from './capabilities'
import { audioBlobToPcmWav } from './wav'
import {
  shouldDropStaleVoiceSegment,
  shouldInterruptBusyAssistant,
  transcriptSegmentIsStillActive,
  type FocusVoiceMode,
} from './voice-focus'

/**
 * The voice loop.
 *
 * One active recogniser/VAD loop runs for the life of the selected voice mode.
 * VRM can replace that loop when the user switches between browser recognition
 * and local Whisper. The microphone remains available during answers so
 * L.U.M.I.A. can preserve barge-in where the active engine supports it.
 *
 * The obvious design — one recogniser hunting for the wake word, a second one
 * capturing the command, stopping the first to start the second because the
 * browser only hands out one at a time — is what this replaces. It works, but
 * nothing is listening during an answer, so barge-in is impossible, and every
 * restart leaves a quarter-second of deafness that eats whole wake words.
 *
 * Keeping the mic open costs one thing: JARVIS hears himself through the
 * speakers. That is handled here in text rather than in acoustics — see
 * `isEcho` — because the browser gives SpeechRecognition its own capture and
 * won't let us put a canceller in front of it.
 */

export type VoiceMode =
  /** Powered down. Only his name matters. */
  | 'wake'
  /** He is expecting you to speak. Everything is a command. */
  | 'command'
  /** He is thinking or talking. Anything you say is an interruption. */
  | 'guard'
  /** Something is playing that must not be transcribed at all. */
  | 'deaf'

export type VoiceTranscriptEvent = {
  id: string
  text: string
  provider: 'browser' | 'whisper-local' | 'elevenlabs'
  kind: 'speech' | 'self-echo'
  capturedMode: VoiceMode
  at: number
}

export type VoiceHandlers = {
  /** Read fresh on every result, so the app never has to re-subscribe. */
  mode: () => VoiceMode
  /** Fired on his name, from a partial — waiting for endpointing feels slow.
   *  `trailing` is whatever followed it, so "Jarvis, what's the weather" is
   *  one breath rather than two turns. */
  onWake: (trailing: string) => void
  /** The user has genuinely started talking. This is the barge-in trigger. */
  onSpeechStart: () => void
  /** Live transcript, for the caption under the reactor. */
  onPartial: (text: string) => void
  /** A raw recogniser segment before turn assembly/model submission. */
  onTranscript?: (event: VoiceTranscriptEvent) => void
  /** A complete, endpointed utterance. */
  onUtterance: (text: string) => void
  /** The recogniser is unusable. Distinct from the user saying nothing. */
  onError: (message: string) => void
}

export type Voice = {
  stop: () => void
  /** True while a recogniser is actually running. */
  live: () => boolean
}

// ---------------------------------------------------------------------------
// Endpointing
// ---------------------------------------------------------------------------

/** One utterance often produces several partials containing his name. */
const WAKE_DEBOUNCE = 1500

/**
 * His name, and the only wake phrase.
 *
 * The optional prefix is genuinely optional: addressing him by name alone is
 * correct, and during an answer "Jarvis" on its own is the natural way to cut
 * in. The negative lookahead keeps possessives ("Jarvis's job") from waking him.
 *
 * The alternates are not padding. "Jarvis" is not in a general dictation
 * model's high-frequency vocabulary, and Chrome routinely returns Travis,
 * Jervis, Jarvys or Java's for a perfectly clear utterance — every one of which
 * used to be silently discarded, so the wake word "just didn't work" with no
 * indication why. Better a rare false wake than a name that does not answer.
 */
const WAKE =
  /\b(?:hey|hi|ok|okay|yo|oye|hola)?\s*(?:lumi|lumia|lumi a|jarvis|jarvys|jervis|jarvis's|travis|jarviss|java's|jarv)\b(?!'s)/i

/** Everything after the wake phrase, which is usually the actual command. */
function afterWake(text: string): string {
  const m = WAKE.exec(text)
  if (!m) return ''
  return text
    .slice(m.index + m[0].length)
    .replace(/^[\s,.:;!?-]+/, '')
    .trim()
}

// ---------------------------------------------------------------------------
// Assembling one utterance out of several segments
// ---------------------------------------------------------------------------

/**
 * Why this exists.
 *
 * The voice-activity detector is an energy gate, and energy is a fact about the
 * room rather than about the sentence. It ends a segment after a fixed quiet
 * gap, so "what's the weather in — " *pause* " — London" is two segments, two
 * transcripts and, before this, two turns: the first one asking the model a
 * truncated question, the second arriving as a bare noun with no question left
 * to attach it to. People pause. They pause to think of the word, to look at
 * something, mid-list, before the important part. An assistant that treats the
 * first gap as the end of the thought is one you have to talk to carefully, and
 * having to talk carefully is the whole failure.
 *
 * So the segment is no longer the turn. Transcripts accumulate here, and the
 * turn fires only when the text looks finished AND the room has gone quiet.
 *
 * Crucially this costs nothing in the common case. A complete sentence with no
 * one speaking fires immediately — `holdFor` returns 0 — so the latency of an
 * ordinary question is exactly what it was. The waiting only happens when there
 * is a reason to wait.
 */

/**
 * Ending on one of these means the sentence is not over, whatever the silence
 * says. Function words only: they are closed-class, so the list is complete in
 * a way a content-word list could never be, and none of them is a plausible
 * last word of a real request.
 */
const CONTINUES =
  /\b(and|or|but|so|because|since|if|when|while|that|which|who|whose|to|of|in|on|at|by|for|with|from|about|into|onto|over|under|between|through|the|a|an|my|your|his|her|its|our|their|is|are|was|were|be|been|do|does|did|have|has|had|can|could|would|should|will|shall|might|must|like|than|then|as|very|really|just|some|any|all|both|either|neither|y|o|pero|porque|si|cuando|mientras|que|cual|quien|de|del|en|por|para|con|desde|sobre|entre|hacia|el|la|los|las|un|una|unos|unas|mi|mis|tu|tus|su|sus|nuestro|nuestra|es|son|era|eran|ser|estar|está|estan|están|puede|puedo|podría|podria|quiero|como|más|mas|muy|algo|algún|alguna|todo|ambos)$/i

/** Trailing punctuation a transcriber emits mid-thought. */
const TRAILS = /[,;:–—-]$/

/**
 * A barge-in this soon after he starts a sentence is him, not you.
 *
 * Echo cancellation and the raised guard threshold stop most of his playback
 * reaching the detector, but the attack of the very first syllable is the
 * loudest, least-cancelled thing in the whole answer — it arrives before the
 * canceller has adapted to it. Without this, a long answer could interrupt
 * itself on its own first word, which reads as JARVIS refusing to speak.
 *
 * Kept short deliberately. This is the one window where a genuine interruption
 * is also least likely: the user has not yet heard enough to want to stop him.
 */
const SELF_GUARD_MS = 900

/**
 * A quiet gap this long with a finished-looking sentence ends the turn.
 *
 * Small on purpose: by the time a transcript reaches the assembler the detector
 * has already sat through SILENCE_MS of quiet and the transcriber has taken its
 * own few hundred milliseconds, so roughly a second of real silence has passed
 * already. All this window has to catch is someone drawing breath to add one
 * more clause. Making it generous here is what would make every ordinary
 * question feel slow.
 */
const SETTLE_MS = 250
/** ...and this long when the sentence is plainly unfinished. */
const CONTINUE_MS = 1600
/**
 * Nothing is held longer than this in total. A ceiling rather than a timer:
 * without it, someone who ends every clause on "and" could hold a turn open
 * for ever, and the assistant would look like it had stopped listening.
 */
const MAX_HOLD_MS = 6000

/**
 * Browser SpeechRecognition is more eager to endpoint/restart than the VAD path.
 * Give natural dictation more breathing room so a longer Spanish question is
 * not dispatched after the first small pause.
 */
const BROWSER_SILENCE_MS = 1200
const BROWSER_SETTLE_MS = 300
const BROWSER_CONTINUE_MS = 2400
const BROWSER_MAX_HOLD_MS = 30000

/**
 * How long to keep waiting, given what has been said so far.
 * 0 means "this is a complete thought, send it now".
 */
function holdFor(
  text: string,
  settleMs = SETTLE_MS,
  continueMs = CONTINUE_MS,
): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return continueMs
  // An explicit terminator is the speaker telling us they are done.
  if (/[.!?]$/.test(text)) return 0
  if (TRAILS.test(text.trim())) return continueMs
  if (CONTINUES.test(words[words.length - 1])) return continueMs
  // One or two words is usually the start of something, not the whole of it —
  // except for the short commands that genuinely are complete.
  if (words.length <= 2 && !OVERRIDE.test(text)) return continueMs
  return settleMs
}

type Assembler = {
  /** Add a transcript. `active` is true if the user is audibly still going. */
  feed: (text: string, active: boolean) => void
  /** Send whatever is held right now, if anything. */
  flush: () => void
  /** Throw away whatever is held — used when he stands down. */
  cancel: () => void
  held: () => string
}

function makeAssembler(
  h: {
    emit: (text: string) => void
    partial: (text: string) => void
  },
  timing: {
    settleMs?: number
    continueMs?: number
    maxHoldMs?: number
  } = {},
): Assembler {
  const settleMs = timing.settleMs ?? SETTLE_MS
  const continueMs = timing.continueMs ?? CONTINUE_MS
  const maxHoldMs = timing.maxHoldMs ?? MAX_HOLD_MS
  let held = ''
  let timer: ReturnType<typeof setTimeout> | null = null
  let firstAt = 0

  const clear = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const fire = () => {
    clear()
    const text = held.trim()
    held = ''
    firstAt = 0
    if (text) h.emit(text)
  }

  return {
    feed(text, active) {
      if (!text.trim()) return
      held = `${held} ${text}`.replace(/\s+/g, ' ').trim()
      if (!firstAt) firstAt = Date.now()
      // The caption shows the whole thought as it assembles, not just the
      // fragment that happened to arrive last.
      h.partial(held)
      diag.holding = held
      clear()

      // Already talking again. Decide nothing now — the next transcript is
      // part of this same sentence and will bring more of it.
      if (active) {
        timer = setTimeout(fire, maxHoldMs)
        return
      }

      const wait = Math.min(
        holdFor(held, settleMs, continueMs),
        Math.max(0, maxHoldMs - (Date.now() - firstAt)),
      )
      diag.waitedMs = wait
      if (wait === 0) {
        fire()
        return
      }
      timer = setTimeout(fire, wait)
    },
    flush: fire,
    cancel() {
      clear()
      held = ''
      firstAt = 0
      diag.holding = ''
    },
    held: () => held,
  }
}

// ---------------------------------------------------------------------------
// Hearing himself
// ---------------------------------------------------------------------------

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Short words that must always cut through, even when they collide with what
 * he happens to be saying. Suppressing "stop" because he just said "stop"
 * would be the single most infuriating failure this file could have.
 */
const OVERRIDE =
  /^(?:(?:lumi|lumia|jarvis)[\s,.:;!?-]+)?(?:stop|wait|cancel|enough|quiet|hold on|shut up|never ?mind|forget it|no|para|espera|cancela|basta|silencio|calla|olvida|déjalo|dejalo)(?:\s+por favor)?[\s,.!?]*$/i

/**
 * Words too common to be evidence of anything.
 *
 * This set is the difference between a usable filter and an infuriating one.
 * "What about the second one?" is a perfectly ordinary follow-up, and every
 * word in it is likely to appear somewhere in the answer it follows — so a
 * naive bag-of-words match suppresses the user's real question as an echo.
 * Only distinctive words count as proof he is hearing himself.
 */
const STOP = new Set(
  ('a an the and or but so of to in on at by for with from is are was were be ' +
    'it its this that these those i you he she we they me him her them my your ' +
    'our their what which who how why when where do does did can could would ' +
    'should will shall not no yes if then than as about into over under out up ' +
    'down one two three first second third now here there just very really got ' +
    'get have has had say said tell me okay ok well right ' +
    'el la los las un una unos unas y o pero de del a en por para con desde es son ' +
    'era eran ser estar está estan están esto esta ese esa esos esas yo tú tu usted ' +
    'él ella nosotros ustedes ellos ellas me te se mi mis su sus nuestro nuestra ' +
    'qué que cuál cual quién quien cómo como porqué porque cuándo cuando dónde donde ' +
    'puedo puede puedes podría podria debería deberia quiero quieres no sí si entonces ' +
    'más mas muy algo todo uno dos tres primero segundo tercero ahora aquí aqui allí ' +
    'solo sólo ya bien vale').split(' '),
)

/**
 * Is this the microphone hearing the speakers?
 *
 * Compared as bags of words rather than by string distance: the recogniser
 * mangles its own playback badly enough that a substring match rarely holds,
 * but the *words* survive.
 */
function isEcho(
  heard: string,
  spoken: string,
  strict = false,
): boolean {
  if (!spoken) return false
  if (OVERRIDE.test(heard)) return false

  const all = norm(heard).split(' ').filter(Boolean)
  if (!all.length) return true

  const mine = new Set(norm(spoken).split(' '))
  const content = all.filter((w) => !STOP.has(w))

  // Nothing distinctive was said at all, so there is no strong evidence either
  // way. Demand a total match before discarding it — the cost of dropping a
  // real question is much higher than the cost of one stray echo getting in.
  if (content.length < 2) {
    if (all.length < 2) return false
    return all.every((w) => mine.has(w))
  }

  let hits = 0
  for (const w of content) if (mine.has(w)) hits++
  return hits / content.length >= (strict ? 0.5 : 0.6)
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * Live state of the voice loop, published on `window.__voice`.
 *
 * When someone says the wake word and nothing happens there are only a handful
 * of possible causes — the recogniser never started, it started and died, it is
 * running but hearing silence, or it is hearing you and transcribing the name
 * as something else. From outside the page those are indistinguishable, which
 * makes the failure impossible to report and impossible to fix. This tells them
 * apart in one glance.
 */
export const diag = {
  /** Which input engine is running: 'elevenlabs' (VAD+Scribe) or 'browser'. */
  engine: 'browser',
  /** Whether the microphone pipeline is live. */
  running: false,
  /** Speech segments captured since load. */
  sessions: 0,
  /** The most recent transcript, whatever the mode. */
  heard: '',
  heardAt: 0,
  /** Last failure — a transcription error, or a capture error. */
  lastError: '',
  /** Times the wake word matched. */
  wakes: 0,
  /** Current mode, as the app last reported it. */
  mode: '',
  /** Why the last transcript was ignored — '' when it was accepted. */
  dropped: '',
  /** Transcripts accepted and passed to the app. */
  accepted: 0,
  /** Text assembled but not yet sent, because the thought looks unfinished. */
  holding: '',
  /** How long the assembler decided to wait before sending, in ms. */
  waitedMs: 0,
  /** Barge-ins suppressed because he had only just started the sentence. */
  selfGuarded: 0,
  /** Transcription failures (network, or the bridge speech proxy). */
  restarts: 0,
  /** Queued audio discarded because its original turn already closed. */
  staleSegments: 0,
  /** Busy-time household speech heard but intentionally not treated as barge-in. */
  householdIgnored: 0,
  /** Transcripts classified as L.U.M.I.A.'s own loudspeaker echo. */
  selfEchoes: 0,
  /** Milliseconds the last transcription round-trip took. */
  idleMs: 0,
}

/** Record why a transcript went nowhere. Silence always has a reason; this is
 *  the difference between debugging it and speculating about it. */
function drop(why: string) {
  diag.dropped = why
}

if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__voice = diag
}

/**
 * Pick the voice engine and start it.
 *
 * Engines are selected through VRM using bridge readiness:
 *   - local -> VAD + local Whisper.cpp when installed;
 *   - browser -> browser SpeechRecognition;
 *   - auto -> local Whisper when ready, otherwise ElevenLabs if configured,
 *     otherwise the browser fallback.
 *
 * The microphone is opened once here so a denied permission is reported loudly
 * rather than surfacing later as an unexplained deafness, whichever engine runs.
 */
export async function startVoice(h: VoiceHandlers): Promise<Voice> {
  try {
    await getMic()
  } catch (err) {
    diag.lastError = 'mic'
    h.onError(
      err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access denied — voice input is unavailable.'
        : 'No microphone available.',
    )
    return { stop: () => {}, live: () => false }
  }
  const capability = caps()
  const requested = capability.voice?.requested?.sttMode ?? 'auto'
  const localReady = Boolean(capability.voice?.local?.sttAvailable)

  if (requested === 'browser') {
    diag.engine = 'browser'
    return startBrowserVoice(h)
  }

  if ((requested === 'local' || requested === 'auto') && localReady) {
    diag.engine = 'whisper-local'
    return startVadBridgeVoice(h, 'local')
  }

  if (requested === 'auto' && capability.stt) {
    diag.engine = 'elevenlabs'
    return startVadBridgeVoice(h, 'elevenlabs')
  }

  // An explicitly requested local runtime that is not ready falls back safely
  // rather than leaving L.U.M.I.A. deaf.
  diag.engine = 'browser'
  return startBrowserVoice(h)
}

/** VAD + bridge transcription: local Whisper.cpp or ElevenLabs Scribe. */
async function startVadBridgeVoice(
  h: VoiceHandlers,
  provider: 'elevenlabs' | 'local',
): Promise<Voice> {
  let lastWake = 0
  let vad: Vad | null = null

  /**
   * Segments waiting for the transcriber, oldest first.
   *
   * This was a boolean — `if (transcribing) return` — and that single line was
   * the worst bug in the pause story. Segments arrive faster than Scribe
   * answers whenever someone speaks in bursts, which is exactly what pausing
   * mid-sentence looks like, so the second half of the thought was not merely
   * mis-timed, it was silently discarded. Queue instead: nothing a person says
   * out loud gets thrown away because the network was busy.
   *
   * Order is preserved because the drain is single-flight, which matters —
   * "London" arriving before "what's the weather in" is worse than either.
   */
  const pendingAudio: Array<{
    blob: Blob
    capturedMode: FocusVoiceMode
    epoch: number
  }> = []
  let draining = false
  let captureEpoch = 0

  /**
   * Transcripts become turns here rather than one-per-segment.
   * See makeAssembler for why.
   */
  const assemble = makeAssembler({
    emit: (text) => {
      // Seal the turn the moment one coherent command is accepted. Audio that
      // arrived while Whisper was decoding this command belongs to a later
      // speaker/turn and must not be appended just because it is already queued.
      captureEpoch++
      pendingAudio.length = 0
      diag.dropped = ''
      diag.accepted++
      diag.holding = ''
      h.onUtterance(text)
    },
    partial: (text) => h.onPartial(text),
  })

  /**
   * Send one captured segment to the bridge and act on the words.
   *
   * The mode is re-read here, not at capture time, because a barge-in flips the
   * machine from 'guard' to 'listening' between the segment starting and its
   * transcript arriving — and the transcript belongs to the mode the user is in
   * now, not the one they interrupted.
   */
  const transcribe = async (
    blob: Blob,
    capturedMode: FocusVoiceMode,
    epoch: number,
  ) => {
    const mode = h.mode()
    if (mode === 'deaf') return

    if (shouldDropStaleVoiceSegment(capturedMode, mode)) {
      diag.staleSegments++
      drop(
        `stale ${capturedMode} audio ignored after mode changed to ${mode}`,
      )
      return
    }
    const t0 = performance.now()
    try {
      const requestBlob =
        provider === 'local' ? await audioBlobToPcmWav(blob) : blob
      const endpoint = provider === 'local' ? '/stt/local' : '/stt'
      const res = await fetch(`${BRIDGE_HTTP_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'content-type':
            requestBlob.type ||
            (provider === 'local' ? 'audio/wav' : 'audio/webm'),
        },
        body: requestBlob,
      })
      diag.idleMs = Math.round(performance.now() - t0)
      if (!res.ok) {
        diag.restarts++
        diag.lastError = `stt ${res.status}`
        drop(`transcription failed (${res.status})`)
        return
      }
      const { text } = (await res.json()) as { text?: string }
      const said = (text ?? '').trim()
      diag.lastError = ''

      // A previous segment may have completed the command while this one was
      // still inside Whisper. Do not let the late result reopen that turn.
      if (epoch !== captureEpoch) {
        diag.staleSegments++
        drop('late transcript ignored after command turn was sealed')
        return
      }

      if (!said) {
        drop('nothing intelligible in the segment')
        return
      }

      // L.U.M.I.A. is on loudspeakers, so the microphone can receive her
      // own answer as if a second person were talking. For audio captured while
      // she was busy, compare against the rolling TTS history rather than only
      // the current sentence: Whisper may return several seconds late.
      const echoReference =
        capturedMode === 'guard'
          ? speakingEchoReference()
          : speakingNow()
      const selfEcho =
        !OVERRIDE.test(said) &&
        isEcho(said, echoReference, capturedMode === 'guard')

      diag.heard = said
      diag.heardAt = Date.now()
      h.onTranscript?.({
        id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: said,
        provider: provider === 'local' ? 'whisper-local' : 'elevenlabs',
        kind: selfEcho ? 'self-echo' : 'speech',
        capturedMode: capturedMode as VoiceMode,
        at: Date.now(),
      })

      if (selfEcho) {
        diag.selfEchoes++
        drop('echo of L.U.M.I.A. loudspeaker output')
        return
      }

      // Household Focus for local Whisper: speech captured while L.U.M.I.A. is
      // busy remains visible in ESCUCHANDO, but it cannot cancel the answer or
      // become a new command unless the speaker explicitly says her name or an
      // interrupt phrase. This is what keeps a child/spouse/TV from hijacking a
      // turn simply by talking nearby.
      if (provider === 'local' && capturedMode === 'guard') {
        if (
          !shouldInterruptBusyAssistant(said, {
            wake: WAKE,
            override: OVERRIDE,
          })
        ) {
          diag.householdIgnored++
          drop('household speech observed while busy; explicit Lumi/interrupt required')
          return
        }

        h.onSpeechStart()

        // "Lumi, explícame..." is an intentional barge-in and should become a
        // new command. A bare "Lumi" or "para" only stops the current answer
        // and leaves the assistant listening for what comes next.
        const trailing = WAKE.test(said) ? afterWake(said) : ''
        if (trailing) h.onUtterance(trailing)
        return
      }

      if (mode === 'wake') {
        if (WAKE.test(said) && Date.now() - lastWake > WAKE_DEBOUNCE) {
          lastWake = Date.now()
          diag.wakes++
          diag.dropped = ''
          diag.accepted++
          h.onWake(afterWake(said))
        } else {
          drop(`heard "${said.slice(-40)}" — not his name`)
        }
        return
      }

      // Not a turn yet — a piece of one. This segment has already ended before
      // Whisper starts decoding it. Do not look at the microphone's *current*
      // activity here: that may be a child, television or another speaker who
      // began talking while transcription was still running. The assembler
      // decides continuation from the returned text and bounded timing instead.
      assemble.feed(said, transcriptSegmentIsStillActive())
    } catch (err) {
      diag.restarts++
      diag.lastError = String(err)
      drop(
        provider === 'local'
          ? 'could not use local Whisper'
          : 'could not reach the speech service',
      )
    }
  }

  /** One transcription at a time, in the order the segments were spoken. */
  const drain = async () => {
    if (draining) return
    draining = true
    try {
      while (pendingAudio.length) {
        const pending = pendingAudio.shift()!
        await transcribe(
          pending.blob,
          pending.capturedMode,
          pending.epoch,
        )
      }
    } finally {
      draining = false
    }
  }

  vad = await startVad({
    onStart: () => {
      const mode = h.mode()
      diag.mode = mode
      diag.sessions++
      if (mode === 'deaf') return
      // Standing down mid-thought throws the thought away with it. Otherwise
      // held text would surface as the opening of the *next* conversation.
      if (mode === 'wake') assemble.cancel()
      // The barge-in. In guard mode the user has started talking over him, and
      // because the guard threshold is high this is a real interruption rather
      // than leaked playback — so cut him off now, do not wait for the words.
      if (mode === 'guard') {
        const since = speakingSince()
        if (since && Date.now() - since < SELF_GUARD_MS) {
          diag.selfGuarded++
          return
        }

        // Local Whisper uses Household Focus: wait for the transcript before
        // deciding whether this is an intentional interruption. ElevenLabs
        // keeps the historical natural barge-in behavior.
        if (provider !== 'local') h.onSpeechStart()
      }
    },
    onEnd: (blob) => {
      pendingAudio.push({
        blob,
        capturedMode: h.mode() as FocusVoiceMode,
        epoch: captureEpoch,
      })
      void drain()
    },
    onLevel: (v) => {
      // Only paint the live level while actually listening for a command, so a
      // dormant reactor stays calm and does not twitch at every room noise.
      const mode = h.mode()
      if (mode !== 'command') return
      // Never over the assembled text. This used to run unconditionally and
      // overwrote a half-built sentence with an ellipsis sixty times a second,
      // so a pause looked like the interface had forgotten what you just said.
      if (assemble.held()) return
      h.onPartial(v > 0.04 ? '…' : '')
    },
    onError: (message) => {
      diag.lastError = 'capture'
      diag.running = false
      h.onError(message)
    },
  })
  diag.running = vad.live()

  // Raise the trigger bar exactly while he speaks. The mode is polled rather
  // than pushed because nothing in the app pushes phase changes here, and a
  // 200ms lag on the echo gate is imperceptible.
  const guardPoll = setInterval(() => {
    const mode = h.mode()
    vad?.setGuard(mode === 'guard')
    // He has stood down — by Escape, by the idle timeout, or by dropping back
    // to the wake word. Anything half-said belonged to a conversation that is
    // over, and letting the hold expire later would open the next one with a
    // fragment of the last.
    if ((mode === 'wake' || mode === 'deaf') && assemble.held()) assemble.cancel()
  }, 200)

  return {
    stop: () => {
      clearInterval(guardPoll)
      assemble.cancel()
      vad?.stop()
      diag.running = false
    },
    live: () => vad?.live() ?? false,
  }
}

/* -------------------------------------------------------------------------- */
/* Browser fallback: SpeechRecognition                                        */
/* -------------------------------------------------------------------------- */

/**
 * The keyless path. Uses the browser's own SpeechRecognition for both detection
 * and transcription, so a student who has configured nothing still gets voice.
 *
 * It is the flakier engine — Chrome throttles it and it can go silent with no
 * event to catch — so a heartbeat watches it and forces a fresh session
 * whenever it stops showing signs of life. That single guard is the difference
 * between "the wake word stopped working halfway through the lesson" and an
 * assistant that keeps listening.
 */
function startBrowserVoice(h: VoiceHandlers): Voice {
  const Ctor =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
  if (!Ctor) {
    h.onError('This browser has no speech recognition — use Chrome or Edge, or add an ElevenLabs key.')
    return { stop: () => {}, live: () => false }
  }

  let stopped = false
  let running = false
  let rec: any = null
  let settled = ''
  let interim = ''
  let started = false
  let barged = false
  let lastWake = 0
  let lastAlive = Date.now()
  let silenceTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Browser recognition endpoints more aggressively than the VAD path. Keep
   * partial thoughts together for longer so natural pauses in a longer request
   * do not become separate user turns.
   */
  const assemble = makeAssembler(
    {
      emit: (text) => {
        diag.dropped = ''
        diag.accepted++
        diag.holding = ''
        h.onUtterance(text)
      },
      partial: (text) => h.onPartial(text),
    },
    {
      settleMs: BROWSER_SETTLE_MS,
      continueMs: BROWSER_CONTINUE_MS,
      maxHoldMs: BROWSER_MAX_HOLD_MS,
    },
  )

  const touch = () => {
    lastAlive = Date.now()
  }

  const clearSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer)
    silenceTimer = null
  }

  const reset = () => {
    clearSilence()
    settled = ''
    interim = ''
    started = false
    barged = false
  }

  const emit = () => {
    const text = `${settled} ${interim}`.replace(/\s+/g, ' ').trim()
    const mode = h.mode()
    reset()
    if (!text || mode === 'deaf') return
    const browserEchoReference =
      mode === 'guard' ? speakingEchoReference() : speakingNow()
    const selfEcho =
      !OVERRIDE.test(text) &&
      isEcho(text, browserEchoReference, mode === 'guard')

    diag.heard = text
    diag.heardAt = Date.now()
    h.onTranscript?.({
      id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      provider: 'browser',
      kind: selfEcho ? 'self-echo' : 'speech',
      capturedMode: mode,
      at: Date.now(),
    })

    if (selfEcho) {
      diag.selfEchoes++
      drop('echo of L.U.M.I.A. loudspeaker output')
      return
    }
    if (mode === 'wake') {
      assemble.cancel()
      if (WAKE.test(text) && Date.now() - lastWake > WAKE_DEBOUNCE) {
        lastWake = Date.now()
        diag.wakes++
        diag.dropped = ''
        diag.accepted++
        h.onWake(afterWake(text))
      } else {
        drop(`heard "${text.slice(-40)}" — not his name`)
      }
      return
    }
    // The recogniser has already endpointed on its own 900ms gap; the assembler
    // decides whether that gap actually ended the thought. `false` because a
    // result only reaches here once the recogniser has gone quiet.
    assemble.feed(text, false)
  }

  const bumpSilence = () => {
    clearSilence()
    // Endpoint on a short quiet gap; the ElevenLabs path tunes this more
    // finely, but a fixed window is plenty for the fallback.
    silenceTimer = setTimeout(emit, BROWSER_SILENCE_MS)
  }

  const onResult = (e: any) => {
    touch()
    const mode = h.mode()
    diag.mode = mode
    if (mode === 'deaf') {
      interim = ''
      return
    }
    let fresh = ''
    interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript as string
      if (e.results[i].isFinal) fresh += chunk
      else interim += chunk
    }
    const heard = `${settled} ${fresh} ${interim}`.replace(/\s+/g, ' ').trim()
    if (!heard) return
    if (isEcho(`${fresh} ${interim}`, speakingNow())) {
      interim = ''
      return
    }

    if (mode === 'wake') {
      settled = `${settled} ${fresh}`.replace(/\s+/g, ' ').trim()
      if (WAKE.test(heard) && Date.now() - lastWake > WAKE_DEBOUNCE) {
        lastWake = Date.now()
        diag.wakes++
        const trailing = afterWake(heard)
        reset()
        h.onWake(trailing)
      } else if (settled.length > 400) {
        settled = ''
      }
      return
    }

    settled = `${settled} ${fresh}`.replace(/\s+/g, ' ').trim()
    const full = `${settled} ${interim}`.replace(/\s+/g, ' ').trim()
    if (!started || (mode === 'guard' && !barged)) {
      if (mode === 'guard') {
        // Chrome's browser SpeechRecognition listens to the same speakers that
        // system TTS uses, so free-form barge-in here is fundamentally prone to
        // self-interruption. In the browser fallback we therefore allow only an
        // explicit interrupt phrase while L.U.M.I.A. is speaking. Natural
        // free-form barge-in remains available on the VAD + server STT path.
        //
        // This prevents L.U.M.I.A. from hearing "Hola, en esta fase..." from
        // her own speakers and cancelling the sentence she is currently saying.
        if (!OVERRIDE.test(full)) {
          if (isEcho(full, speakingNow())) drop('echo of L.U.M.I.A. while speaking')
          else drop('speech ignored while L.U.M.I.A. is speaking; use an interrupt phrase')
          reset()
          return
        }
      }
      started = true
      if (mode === 'guard') barged = true
      h.onSpeechStart()
    }
    diag.dropped = ''
    // Show the whole thought, not just the fragment being spoken now — there
    // may be an earlier half of it held by the assembler.
    const carried = assemble.held()
    h.onPartial(carried ? `${carried} ${full}` : full)
    bumpSilence()
  }

  const spin = () => {
    if (stopped || running) return
    rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = SPEECH_LANG
    rec.onstart = () => {
      running = true
      diag.running = true
      diag.sessions++
      touch()
    }
    rec.onresult = onResult
    rec.onerror = (ev: any) => {
      diag.lastError = String(ev.error ?? '')
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        stopped = true
        diag.running = false
        h.onError('Microphone access was refused — voice input is unavailable.')
      }
    }
    rec.onend = () => {
      running = false
      diag.running = false
      touch()

      // Chrome can end a SpeechRecognition session while the user is still in
      // a long sentence. Preserve that segment before opening the next session;
      // otherwise the next onResult clears the old interim text and the tail of
      // the question appears to have been "cut off".
      if (!stopped && (settled.trim() || interim.trim())) {
        emit()
      }

      rec = null
      if (!stopped) setTimeout(spin, 80)
    }
    try {
      rec.start()
    } catch {
      running = false
      setTimeout(spin, 250)
    }
  }

  spin()

  // The heartbeat. If nothing has been heard from the engine for a while it has
  // gone quiet on us — tear it down and build a fresh one.
  const health = setInterval(() => {
    if (stopped) return
    const idle = Date.now() - lastAlive
    diag.idleMs = idle
    if (idle < 15000) return
    diag.restarts++
    try {
      rec?.abort()
    } catch {
      /* already gone */
    }
    rec = null
    running = false
    diag.running = false
    touch()
    spin()
  }, 5000)

  return {
    stop: () => {
      stopped = true
      clearInterval(health)
      clearSilence()
      assemble.cancel()
      diag.running = false
      try {
        rec?.abort()
      } catch {
        /* noop */
      }
    },
    live: () => running,
  }
}
