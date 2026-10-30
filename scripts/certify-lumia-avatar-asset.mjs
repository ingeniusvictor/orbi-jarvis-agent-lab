import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const path = new URL('../public/models/lumia/lumia.glb', import.meta.url)
const component = readFileSync(new URL('../src/scene/LumiaAvatar.tsx', import.meta.url), 'utf8')
const profile = readFileSync(new URL('../src/scene/avatar-profile.ts', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(
  new URL('../public/models/lumia/AV01B_FACE_MANIFEST.json', import.meta.url), 'utf8',
))
assert.match(component, /const FACE_HEIGHT_FRACTION = 0\.47/)
assert.match(component, /const FACE_SHIFT_PX = 25/)
assert.match(profile, /export const FACE_MODEL_PROFILE = 'face-v1'/)
assert.equal(manifest.marker.value, 'face-v1')

if (!existsSync(path)) {
  // This explicit outcome is NOT proof of asset delivery. The owner must
  // publish the Git blob separately from Windows through the verified script.
  console.log('LUMIA AV-01B: CODE/PROFILE PASS; GLB ABSENT — binary publication pending.')
  process.exit(0)
}
const data = readFileSync(path)
const digest = createHash('sha256').update(data).digest('hex')
assert.equal(digest, manifest.sha256, 'Wrong face model or unexpected binary alteration')
assert.equal(data.length, manifest.bytes)
assert.equal(data.toString('ascii', 0, 4), 'glTF')
assert.equal(data.readUInt32LE(4), 2)
assert.equal(data.readUInt32LE(8), data.length)
const jsonLen = data.readUInt32LE(12)
assert.equal(data.toString('ascii', 16, 20), 'JSON')
const json = JSON.parse(data.subarray(20, 20 + jsonLen).toString('utf8'))
assert.equal(json.nodes?.[0]?.extras?.lumiaAvatarProfile, 'face-v1')
assert.equal(json.asset?.extras?.lumiaVerifiedYUp, true)
console.log('LUMIA AV-01B: FULL FACE GLB BINARY CHECKSUM + PROFILE + CALIBRATION PASS.')
