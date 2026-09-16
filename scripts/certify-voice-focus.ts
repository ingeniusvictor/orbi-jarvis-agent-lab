import assert from 'node:assert/strict'
import {
  shouldDropStaleVoiceSegment,
  transcriptSegmentIsStillActive,
} from '../src/lib/voice-focus'

assert.equal(
  shouldDropStaleVoiceSegment('command', 'command'),
  false,
)
assert.equal(
  shouldDropStaleVoiceSegment('command', 'guard'),
  true,
)
assert.equal(
  shouldDropStaleVoiceSegment('command', 'wake'),
  true,
)
assert.equal(
  shouldDropStaleVoiceSegment('wake', 'wake'),
  false,
)
assert.equal(
  shouldDropStaleVoiceSegment('wake', 'command'),
  true,
)
assert.equal(
  shouldDropStaleVoiceSegment('guard', 'command'),
  false,
)
assert.equal(
  shouldDropStaleVoiceSegment('deaf', 'deaf'),
  true,
)
assert.equal(transcriptSegmentIsStillActive(), false)

console.log('Voice Focus V0 turn isolation smoke test: PASS')
console.log('Queued command audio cannot leak into a later answer.')
console.log('Finished Whisper segments do not inherit unrelated live mic activity.')
console.log('Guard -> command remains allowed for legitimate barge-in transcription.')
