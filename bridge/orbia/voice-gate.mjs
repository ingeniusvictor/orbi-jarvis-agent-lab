/**
 * L.U.M.I.A. Voice Gate — VG-01 foundation.
 *
 * This module defines the safety contract for distinguishing intentional live
 * speech from uncertain/background audio. It is intentionally provider-neutral:
 * wake word, speaker verification and anti-replay/liveness engines can feed
 * evidence without the gate pretending a capability exists before it is
 * installed and benchmarked.
 *
 * VG-01 runs in MONITOR mode by default. Nothing in the current hot path is
 * blocked by this file yet. That preserves the certified Whisper/Qwen/Kokoro
 * runtime while we add acoustic evidence in later phases.
 */

import { probeSpeakerDiarization } from './speaker-diarization-probe.mjs'
import { speakerVerificationStatus } from './speaker-verification.mjs'

export const VOICE_GATE_STATES = Object.freeze([
  'live',
  'uncertain',
  'background',
])

export const VOICE_GATE_MODES = Object.freeze(['monitor', 'enforce'])

const finiteOrNull = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const clamp01 = (value) => {
  const n = finiteOrNull(value)
  if (n === null) return null
  return Math.max(0, Math.min(1, n))
}

export function voiceGateConfig(env = process.env) {
  const requestedMode = String(env.ORBIA_VOICE_GATE_MODE ?? 'monitor')
    .trim()
    .toLowerCase()
  const mode = VOICE_GATE_MODES.includes(requestedMode)
    ? requestedMode
    : 'monitor'

  return Object.freeze({
    mode,
    liveThreshold: clamp01(env.ORBIA_VOICE_GATE_LIVE_THRESHOLD) ?? 0.75,
    replayBlockThreshold:
      clamp01(env.ORBIA_VOICE_GATE_REPLAY_BLOCK_THRESHOLD) ?? 0.65,
  })
}

function decision(state, reasons, evidence, config) {
  const recommended =
    state === 'live'
      ? { submitToBrain: true, allowWrites: true }
      : state === 'uncertain'
        ? { submitToBrain: false, allowWrites: false }
        : { submitToBrain: false, allowWrites: false }

  return Object.freeze({
    state,
    reasons: Object.freeze(reasons),
    mode: config.mode,
    monitorOnly: config.mode === 'monitor',
    recommended: Object.freeze(recommended),
    evidence: Object.freeze(evidence),
  })
}

/**
 * Classify one already-captured utterance.
 *
 * Missing speaker/liveness evidence is not treated as proof of a live human.
 * A wake word/session can establish intent, but without acoustic liveness the
 * truthful state is UNCERTAIN. VG-01 therefore remains monitor-only in the app
 * until a real anti-replay provider is connected and calibrated.
 */
export function classifyVoiceGateEvidence(
  input = {},
  { env = process.env } = {},
) {
  const config = voiceGateConfig(env)
  const evidence = {
    wakeMatched: Boolean(input.wakeMatched),
    sessionOpen: Boolean(input.sessionOpen),
    selfEcho: Boolean(input.selfEcho),
    nonSpeech: Boolean(input.nonSpeech),
    speakerAuthorized:
      typeof input.speakerAuthorized === 'boolean'
        ? input.speakerAuthorized
        : null,
    livenessScore: clamp01(input.livenessScore),
    replayScore: clamp01(input.replayScore),
    replayDecision:
      input.replayDecision === 'live' || input.replayDecision === 'playback'
        ? input.replayDecision
        : null,
  }

  if (evidence.selfEcho) {
    return decision('background', ['assistant-self-echo'], evidence, config)
  }
  if (evidence.nonSpeech) {
    return decision('background', ['non-speech'], evidence, config)
  }

  if (
    evidence.replayDecision === 'playback' ||
    (evidence.replayScore !== null &&
      evidence.replayScore >= config.replayBlockThreshold)
  ) {
    return decision('background', ['probable-playback'], evidence, config)
  }

  if (!evidence.wakeMatched && !evidence.sessionOpen) {
    return decision('background', ['no-active-address'], evidence, config)
  }

  if (evidence.speakerAuthorized === false) {
    return decision('uncertain', ['speaker-not-authorized'], evidence, config)
  }

  if (
    evidence.replayDecision === 'live' ||
    (evidence.livenessScore !== null &&
      evidence.livenessScore >= config.liveThreshold)
  ) {
    return decision('live', ['live-acoustic-evidence'], evidence, config)
  }

  const reasons = ['intent-present']
  if (evidence.speakerAuthorized === true) reasons.push('speaker-authorized')
  reasons.push('liveness-unverified')
  return decision('uncertain', reasons, evidence, config)
}

/**
 * Truthful capability status for diagnostics and /health.
 */
export function buildVoiceGateStatus({ env = process.env } = {}) {
  const config = voiceGateConfig(env)
  const diarization = probeSpeakerDiarization({ env })
  const speaker = speakerVerificationStatus({ env })

  const capabilities = Object.freeze({
    wakeWordGate: true,
    householdFocus: true,
    diarization: diarization.available,
    speakerVerificationEngine: speaker.engineReady,
    speakerVerification: speaker.available,
    acousticFrontEnd: true,
    multiMicArbitration: true,
    toolDomainRouter: true,
    capabilityPolicy: true,
    antiReplay: false,
  })

  return Object.freeze({
    phase: 'VG-03A',
    status:
      !diarization.available
        ? 'FOUNDATION'
        : speaker.available
          ? 'SPEAKER_READY'
          : 'PARTIAL',
    mode: config.mode,
    hotPathIntegrated: false,
    safeToEnforce: false,
    thresholds: Object.freeze({
      live: config.liveThreshold,
      replayBlock: config.replayBlockThreshold,
    }),
    capabilities,
    diarization: Object.freeze({
      provider: diarization.provider,
      available: diarization.available,
      packageReady: diarization.packageReady,
      packageLocation: diarization.packageLocation,
      segmentationReady: diarization.segmentationReady,
      embeddingReady: diarization.embeddingReady,
    }),
    speaker: Object.freeze({
      provider: speaker.provider,
      engineReady: speaker.engineReady,
      enrolled: speaker.enrolled,
      profilePresent: speaker.profilePresent,
      profileProtected: speaker.profileProtected,
      threshold: speaker.threshold,
      available: speaker.available,
    }),
    nextRequired: Object.freeze([
      ...(diarization.available
        ? []
        : ['speaker-diarization-runtime']),
      ...(speaker.available ? [] : ['speaker-verification-enrollment']),
      'anti-replay-liveness-provider',
      'acoustic-room-calibration-benchmark',
      'speaker-threshold-benchmark',
      'wake-engine-dedicated',
      'voice-gate-hot-path-enforcement',
    ]),
  })
}
