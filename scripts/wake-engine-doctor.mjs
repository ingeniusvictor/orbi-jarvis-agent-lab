import { probeWakeEngine } from '../bridge/orbia/wake-engine-probe.mjs'

const wake = probeWakeEngine()

console.log('L.U.M.I.A. Dedicated Wake Engine Doctor')
console.log('---------------------------------------')
console.log(`Canonical target:      ${wake.canonical}`)
console.log(`Requested:             ${wake.requested}`)
console.log(`Selected:              ${wake.selected}`)
console.log(`Dedicated wake engine: ${wake.dedicatedReady ? 'READY' : 'MISSING'}`)
console.log(`Transcript fallback:   ${wake.transcriptFallback ? 'READY' : 'MISSING'}`)
console.log('')
console.log('openWakeWord:')
console.log(`  isolated runtime:     ${wake.openWakeWord.runtimeReady ? 'READY' : 'MISSING'}`)
console.log(`  Lumi ONNX model:      ${wake.openWakeWord.modelReady ? 'READY' : 'MISSING'}`)
console.log('')
console.log('Porcupine optional adapter:')
console.log(`  web package:          ${wake.porcupine.packageReady ? 'READY' : 'MISSING'}`)
console.log(`  Lumi keyword:         ${wake.porcupine.keywordReady ? 'READY' : 'MISSING'}`)
console.log(`  AccessKey configured: ${wake.porcupine.accessKeyConfigured ? 'YES' : 'NO'}`)
console.log('  auto-selected:        NO')
console.log('')
if (!wake.dedicatedReady) {
  console.log('Current wake matching remains post-STT/transcript based.')
}
