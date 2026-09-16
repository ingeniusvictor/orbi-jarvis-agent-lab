import { buildVoiceRuntimeStatus } from '../bridge/orbia/voice-status.mjs'
import { localVoicePaths } from '../bridge/orbia/local-voice-probe.mjs'
import {
  probeSpeakerDiarization,
  speakerDiarizationPaths,
} from '../bridge/orbia/speaker-diarization-probe.mjs'

const status = buildVoiceRuntimeStatus()
const paths = localVoicePaths()
const diarization = probeSpeakerDiarization()
const diarizationPaths = speakerDiarizationPaths()

const mark = (value) => (value ? 'READY' : 'MISSING')

console.log('O.R.B.I.A. / L.U.M.I.A. Voice Doctor')
console.log('-----------------------------------')
console.log(
  `STT requested: ${status.requested.sttMode} · effective: ${status.effective.effectiveStt}`,
)
console.log(
  `TTS requested: ${status.requested.ttsMode} · effective: ${status.effective.effectiveTts}`,
)
console.log(`Voice profile: ${status.requested.voiceProfile}`)
console.log('')
console.log(`Whisper executable: ${mark(status.local.whisper.commandReady)}`)
console.log(`  ${paths.whisperCommand}`)
console.log(`Whisper model:      ${mark(status.local.whisper.modelReady)}`)
console.log(`  ${paths.whisperModel}`)
console.log('')
console.log(`Kokoro Python:      ${mark(status.local.kokoro.pythonReady)}`)
console.log(`  ${paths.kokoroPython}`)
console.log(`Kokoro adapter:     ${mark(status.local.kokoro.scriptReady)}`)
console.log(`  ${paths.kokoroScript}`)
console.log(`Kokoro model:       ${mark(status.local.kokoro.modelReady)}`)
console.log(`  ${paths.kokoroModel}`)
console.log(`Kokoro voices:      ${mark(status.local.kokoro.voicesReady)}`)
console.log(`  ${paths.kokoroVoices}`)
console.log('')
console.log(
  `Local STT: ${status.local.sttAvailable ? 'READY' : 'NOT READY'} · Local TTS: ${status.local.ttsAvailable ? 'READY' : 'NOT READY'}`,
)
console.log('')
console.log('Speaker diarization:')
console.log(`  sherpa-onnx package: ${mark(diarization.packageReady)}`)
console.log(`  segmentation model: ${mark(diarization.segmentationReady)}`)
console.log(`    ${diarizationPaths.segmentationModel}`)
console.log(`  embedding model:    ${mark(diarization.embeddingReady)}`)
console.log(`    ${diarizationPaths.embeddingModel}`)
console.log(
  `  Multivoice runtime: ${diarization.available ? 'READY' : 'NOT READY'}`,
)
