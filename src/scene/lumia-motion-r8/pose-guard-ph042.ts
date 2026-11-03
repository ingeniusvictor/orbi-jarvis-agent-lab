/**
 * PH-04.2 — Non-destructive post-retarget pose envelope.
 *
 * Motion R8 FBX tracks were authored for three-vrm normalized humanoids;
 * Portal Head currently uses GLTFLoader VRM0 RAW bones. Successful loading
 * does not certify that every joint angle is anatomically natural.
 *
 * Bound the additional FBX displacement relative to the trusted procedural
 * natural-pose quaternion each frame. Never rewrite model, FBX or bind-pose.
 */
import * as THREE from 'three'

export const R8_POSE_LIMITS = Object.freeze({
  leftShoulder: [0.24, 0.38], rightShoulder: [0.24, 0.38],
  leftUpperArm: [0.48, 1.02], rightUpperArm: [0.48, 1.02],
  leftLowerArm: [0.58, 1.10], rightLowerArm: [0.58, 1.10],
  leftHand: [0.45, 0.80], rightHand: [0.45, 0.80],
  spine: [0.17, 0.30], chest: [0.20, 0.32],
  upperChest: [0.20, 0.32], hips: [0.12, 0.24],
} as const)

/** True if the original FBX pose was beyond the conservative envelope. */
export function boundR8BodyPose(
  bones: Map<string, THREE.Object3D>,
  procedural: Map<string, THREE.Quaternion>,
  manual: boolean,
): number {
  let corrected = 0
  for (const [name, limits] of Object.entries(R8_POSE_LIMITS)) {
    const node = bones.get(name)
    const base = procedural.get(name)
    if (!node || !base) continue
    const q = node.quaternion
    if (![q.x, q.y, q.z, q.w].every(Number.isFinite)) {
      q.copy(base)
      corrected++
      continue
    }
    const angle = base.angleTo(q)
    const max = limits[manual ? 1 : 0]
    if (angle > max) {
      const target = q.clone()
      q.copy(base).slerp(target, max / angle).normalize()
      corrected++
    }
  }
  return corrected
}
