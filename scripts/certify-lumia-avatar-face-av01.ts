import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { FACE_MODEL_PROFILE, isFaceOnlyAvatar } from '../src/scene/avatar-profile'

const classic = new THREE.Group()
classic.name = 'LUMIA classic'
assert.equal(isFaceOnlyAvatar(classic), false, 'Original model must retain legacy optical layout.')

const face = new THREE.Group()
const markedNode = new THREE.Group()
markedNode.userData.lumiaAvatarProfile = 'face-v1'
face.add(markedNode)
assert.equal(FACE_MODEL_PROFILE, 'face-v1')
assert.equal(isFaceOnlyAvatar(face), true, 'Metadata must be found on nested glTF node.')
markedNode.userData.lumiaAvatarProfile = 'other-model'
assert.equal(isFaceOnlyAvatar(face), false, 'Unknown GLB metadata must not change avatar.')
markedNode.userData.lumiaAvatarProfile = 'face-v1'

const component = readFileSync(new URL('../src/scene/LumiaAvatar.tsx', import.meta.url), 'utf8')
assert.match(component, /const MODEL_URL = '\/models\/lumia\/lumia\.glb'/)
assert.match(component, /const faceOnly = isFaceOnlyAvatar\(object\)/)
assert.match(component, /prepared\.faceOnly \? 0\.52 : 0\.45/)
assert.match(component, /prepared\.faceOnly \? 0 : OPTICAL_SHIFT_PX/)
assert.match(component, /prepared\.faceOnly \? 0 : OPTICAL_LIFT/)
assert.match(component, /cloneMaterial\(child\.material, reactive, faceOnly\)/)
assert.match(component, /clone\.emissiveIntensity = faceOnly \? 0\.12 : 0\.34/)
assert.match(component, /if \(!faceOnly\) \{/)

// Confirm original asset keeps working and does not unexpectedly opt into the
// face-only framing. No new proprietary binary GLB is stored in the PR.
const path = new URL('../public/models/lumia/lumia.glb', import.meta.url)
const bytes = readFileSync(path)
assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
assert.equal(bytes.readUInt32LE(4), 2)
const jsonLength = bytes.readUInt32LE(12)
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'))
assert.equal(Array.isArray(gltf.nodes), true)
assert.equal(gltf.nodes.some((node: { extras?: { lumiaAvatarProfile?: string } }) =>
  node.extras?.lumiaAvatarProfile === FACE_MODEL_PROFILE), false,
  'Committed classic asset remains unchanged; only owner-installed GLB is marked.')

console.log('LUMIA AV-01: classic + marked face GLB optical profiles: PASS')
console.log('Original asset/path retained; no microphone/voice/AI code changed: PASS')
console.log('Owner-provided 3D face visual quality on Windows still pending.')
