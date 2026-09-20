/**
 * L.U.M.I.A. VG-02 local speaker verification.
 *
 * A speaker profile is a 512-dimensional embedding produced by the local
 * sherpa-onnx speaker model. Raw enrollment audio is never persisted.
 * On Windows, the profile JSON is encrypted with DPAPI and bound to the
 * current Windows user.
 */

import { existsSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  decodeMonoPcm16Wav,
} from './speaker-diarization.mjs'
import {
  sherpaRuntimeRequire,
  speakerDiarizationPaths,
} from './speaker-diarization-probe.mjs'

const root = process.cwd()

export const SPEAKER_PROFILE_PATH = resolve(
  root,
  '.local-runtime',
  'voice-gate',
  'speakers',
  'primary.dpapi',
)

const DEFAULT_THRESHOLD = 0.6

function psLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function thresholdFromEnv(env = process.env) {
  const n = Number(env.ORBIA_SPEAKER_VERIFY_THRESHOLD ?? DEFAULT_THRESHOLD)
  if (!Number.isFinite(n)) return DEFAULT_THRESHOLD
  return Math.max(-1, Math.min(1, n))
}

function normalizeVector(values) {
  const vector = Array.from(values ?? [], Number)
  if (!vector.length || vector.some((value) => !Number.isFinite(value))) {
    throw new Error('Invalid speaker embedding.')
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (!Number.isFinite(norm) || norm <= 0) {
    throw new Error('Speaker embedding has zero norm.')
  }
  return vector.map((value) => value / norm)
}

export function cosineSimilarity(a, b) {
  const left = normalizeVector(a)
  const right = normalizeVector(b)
  if (left.length !== right.length) {
    throw new Error('Speaker embeddings must have the same dimensions.')
  }
  let score = 0
  for (let i = 0; i < left.length; i++) score += left[i] * right[i]
  return Math.max(-1, Math.min(1, score))
}

export function averageSpeakerEmbeddings(embeddings) {
  const items = Array.from(embeddings ?? [])
  if (!items.length) throw new Error('At least one speaker embedding is required.')
  const normalized = items.map(normalizeVector)
  const size = normalized[0].length
  if (normalized.some((item) => item.length !== size)) {
    throw new Error('Speaker embeddings must have the same dimensions.')
  }

  const mean = new Array(size).fill(0)
  for (const vector of normalized) {
    for (let i = 0; i < size; i++) mean[i] += vector[i]
  }
  return normalizeVector(mean.map((value) => value / normalized.length))
}

function createExtractor(env = process.env) {
  const runtimeRequire = sherpaRuntimeRequire(env)
  if (!runtimeRequire) throw new Error('sherpa-onnx-node runtime is unavailable.')

  const sherpa = runtimeRequire('sherpa-onnx-node')
  const { embeddingModel } = speakerDiarizationPaths(env)
  if (!existsSync(embeddingModel)) {
    throw new Error('Speaker embedding model is unavailable.')
  }

  return new sherpa.SpeakerEmbeddingExtractor({
    model: embeddingModel,
    numThreads: Number(env.ORBIA_SPEAKER_VERIFY_THREADS ?? 1),
    debug: false,
  })
}

export function computeSpeakerEmbedding(audio, { env = process.env } = {}) {
  const decoded = decodeMonoPcm16Wav(audio)
  if (decoded.sampleRate !== 16000) {
    throw new Error(
      `Speaker verification requires 16000 Hz audio, received ${decoded.sampleRate} Hz.`,
    )
  }

  const extractor = createExtractor(env)
  const stream = extractor.createStream()
  stream.acceptWaveform({
    sampleRate: decoded.sampleRate,
    samples: decoded.samples,
  })
  return Object.freeze(normalizeVector(extractor.compute(stream)))
}

function encryptDpapiText(path, plaintext) {
  if (process.platform !== 'win32') {
    throw new Error('Speaker profile encryption currently requires Windows DPAPI.')
  }

  mkdirSync(resolve(path, '..'), { recursive: true })
  const script = [
    "$ErrorActionPreference='Stop'",
    '$plain=[Console]::In.ReadToEnd()',
    '$secure=ConvertTo-SecureString -String $plain -AsPlainText -Force',
    '$cipher=ConvertFrom-SecureString $secure',
    `Set-Content -LiteralPath ${psLiteral(path)} -Value $cipher -NoNewline`,
  ].join('; ')

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      cwd: root,
      input: plaintext,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15_000,
    },
  )

  if (result.status !== 0) {
    throw new Error('Could not encrypt the local speaker profile with DPAPI.')
  }
}

function decryptDpapiText(path) {
  if (process.platform !== 'win32' || !existsSync(path)) return ''
  const script = [
    "$ErrorActionPreference='Stop'",
    `$cipher=Get-Content -LiteralPath ${psLiteral(path)} -Raw`,
    '$secure=ConvertTo-SecureString $cipher',
    '$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)',
    'try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }',
  ].join('; ')

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15_000,
    },
  )
  if (result.status !== 0) return ''
  return String(result.stdout ?? '')
}

export function saveSpeakerProfile(profile, { path = SPEAKER_PROFILE_PATH } = {}) {
  const payload = {
    version: 1,
    provider: 'sherpa-onnx-local',
    model: '3dspeaker-eres2net-base-16k',
    label: 'primary-user',
    createdAt: new Date().toISOString(),
    sampleCount: Number(profile.sampleCount ?? 0),
    embedding: normalizeVector(profile.embedding),
  }
  encryptDpapiText(path, JSON.stringify(payload))
  return Object.freeze({
    path,
    sampleCount: payload.sampleCount,
    dimensions: payload.embedding.length,
    createdAt: payload.createdAt,
  })
}

export function loadSpeakerProfile({ path = SPEAKER_PROFILE_PATH } = {}) {
  const text = decryptDpapiText(path)
  if (!text) return null

  try {
    const parsed = JSON.parse(text)
    if (parsed?.version !== 1 || !Array.isArray(parsed?.embedding)) return null
    return Object.freeze({
      ...parsed,
      embedding: Object.freeze(normalizeVector(parsed.embedding)),
    })
  } catch {
    return null
  }
}

export function enrollSpeakerFromWavs(
  audios,
  { env = process.env, path = SPEAKER_PROFILE_PATH } = {},
) {
  const samples = Array.from(audios ?? [])
  if (samples.length < 3) {
    throw new Error('Speaker enrollment requires at least 3 voice samples.')
  }
  const embeddings = samples.map((audio) => computeSpeakerEmbedding(audio, { env }))
  const embedding = averageSpeakerEmbeddings(embeddings)
  return saveSpeakerProfile(
    { embedding, sampleCount: samples.length },
    { path },
  )
}

export function verifySpeakerWav(
  audio,
  { env = process.env, path = SPEAKER_PROFILE_PATH } = {},
) {
  const profile = loadSpeakerProfile({ path })
  if (!profile) {
    return Object.freeze({
      available: false,
      authorized: null,
      score: null,
      threshold: thresholdFromEnv(env),
      reason: 'profile-missing',
    })
  }

  const candidate = computeSpeakerEmbedding(audio, { env })
  const score = cosineSimilarity(profile.embedding, candidate)
  const threshold = thresholdFromEnv(env)
  return Object.freeze({
    available: true,
    authorized: score >= threshold,
    score,
    threshold,
    reason: score >= threshold ? 'speaker-match' : 'speaker-mismatch',
  })
}

export function speakerVerificationStatus(
  { env = process.env, path = SPEAKER_PROFILE_PATH } = {},
) {
  const runtimeReady = Boolean(sherpaRuntimeRequire(env))
  const { embeddingModel } = speakerDiarizationPaths(env)
  const modelReady = existsSync(embeddingModel)
  const profilePresent = existsSync(path)
  const profileReadable = profilePresent ? Boolean(loadSpeakerProfile({ path })) : false

  return Object.freeze({
    provider: 'sherpa-onnx-local',
    engineReady: runtimeReady && modelReady,
    enrolled: profileReadable,
    profilePresent,
    profileProtected:
      process.platform === 'win32' && profilePresent,
    threshold: thresholdFromEnv(env),
    available: runtimeReady && modelReady && profileReadable,
  })
}
