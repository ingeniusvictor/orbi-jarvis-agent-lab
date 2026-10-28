import * as THREE from 'three'

/**
 * Marker written to node.extras of the owner's face-only GLB replacement.
 * It is transported by GLTFLoader into Object3D.userData.
 * Older/original LUMIA models have no marker and keep their existing framing.
 */
export const FACE_MODEL_PROFILE = 'face-v1'

export function isFaceOnlyAvatar(scene: THREE.Object3D): boolean {
  let found = false
  scene.traverse((node) => {
    if (node.userData?.lumiaAvatarProfile === FACE_MODEL_PROFILE) found = true
  })
  return found
}
