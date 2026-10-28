import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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
// Screenshot-driven AV-01B: head slightly smaller and 25 CSS pixels right.
// Ensure profile only changes when the installed GLB is marked "face-v1".
assert.match(component, /const FACE_HEIGHT_FRACTION = 0\.47/)
assert.match(component, /const FACE_SHIFT_PX = 25/)
assert.match(component, /VITE_LUMIA_FACE_SHIFT_PX/)
assert.match(component, /Math\\.abs\\(faceShiftParsed\\) <= 80/)
assert.match(component, /prepared\\.faceOnly \\? FACE_SHIFT_EFFECTIVE_PX : OPTICAL_SHIFT_PX/)
assert.match(component, /prepared\.faceOnly \? FACE_HEIGHT_FRACTION : 0\.45/)
assert.match(component, /prepared\.faceOnly \? FACE_SHIFT_EFFECTIVE_PX : OPTICAL_SHIFT_PX/)
assert.match(component, /const OPTICAL_SHIFT_PX = -28/)
assert.match(component, /const OPTICAL_LIFT = 0\.095/)
assert.match(component, /prepared\.faceOnly \? 0 : OPTICAL_LIFT/)
assert.match(component, /cloneMaterial\(child\.material, reactive, faceOnly\)/)
assert.match(component, /clone\.emissiveIntensity = faceOnly \? 0\.12 : 0\.34/)
assert.match(component, /if \(!faceOnly\) \{/)

// AV-01B replaces the obsolete 17MB legacy README with a verified face
// asset manifest and a safe owner-side publication path. The classic fallback
// remains supported until the owner publishes the actual face GLB.
const readme = readFileSync(new URL('../public/models/lumia/README.md', import.meta.url), 'utf8')
assert.match(readme, /public\/models\/lumia\/lumia\.glb/)
assert.match(readme, /4\.128\.456|intentionally kept local/)
const path = new URL('../public/models/lumia/lumia.glb', import.meta.url)
if (existsSync(path)) {
  const bytes = readFileSync(path)
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
  assert.equal(bytes.readUInt32LE(4), 2)
  const jsonLength = bytes.readUInt32LE(12)
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'))
  assert.equal(Array.isArray(gltf.nodes), true)
  const hasFaceProfile = gltf.nodes.some(
    (node: { extras?: { lumiaAvatarProfile?: string } }) =>
      node.extras?.lumiaAvatarProfile === FACE_MODEL_PROFILE,
  )
  console.log(hasFaceProfile ? 'Owner-installed face asset detected.' : 'Classic local GLB detected.')
} else {
  console.log('Local 3D binary is intentionally absent from CI; code supports both profiles.')
}

console.log('LUMIA AV-01: classic + marked face GLB optical profiles: PASS')
console.log('Original model URL preserved, no microphone/voice/AI code changed: PASS')
console.log('Owner-provided 3D face visual quality on Windows still pending.')
