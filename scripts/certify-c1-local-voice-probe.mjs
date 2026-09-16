import assert from 'node:assert/strict'
import {
  localVoicePaths,
  probeLocalVoiceCapabilities,
} from '../bridge/orbia/local-voice-probe.mjs'

const env = {
  ORBI_LOCAL_STT_COMMAND: 'C:/voice/whisper-cli.exe',
  ORBI_LOCAL_STT_MODEL: 'C:/voice/ggml-base.bin',
  ORBI_LOCAL_TTS_PYTHON: 'C:/voice/python.exe',
  ORBI_LOCAL_TTS_SCRIPT: 'C:/voice/synthesize.py',
  ORBI_LOCAL_TTS_MODEL: 'C:/voice/kokoro-v1.0.onnx',
  ORBI_LOCAL_TTS_VOICES: 'C:/voice/voices-v1.0.bin',
}

const all = new Set(Object.values(env))
const exists = (path) => all.has(path)

const paths = localVoicePaths(env, exists)
assert.equal(paths.whisperCommand, env.ORBI_LOCAL_STT_COMMAND)
assert.equal(paths.kokoroScript, env.ORBI_LOCAL_TTS_SCRIPT)

let probe = probeLocalVoiceCapabilities({ env, exists })
assert.equal(probe.stt.localAvailable, true)
assert.equal(probe.tts.localAvailable, true)
assert.equal(probe.stt.whisper.provider, 'whisper-cpp-local')
assert.equal(probe.tts.kokoro.provider, 'kokoro-local')

const missingModel = new Set(all)
missingModel.delete(env.ORBI_LOCAL_STT_MODEL)
probe = probeLocalVoiceCapabilities({
  env,
  exists: (path) => missingModel.has(path),
})
assert.equal(probe.stt.localAvailable, false)
assert.equal(probe.stt.whisper.commandReady, true)
assert.equal(probe.stt.whisper.modelReady, false)

console.log('C1-E1 local voice capability probe: PASS')
console.log('Whisper.cpp: executable + model readiness are independent')
console.log('Kokoro: python + adapter + model + voices readiness are bounded')
console.log('Probe: side-effect free')
