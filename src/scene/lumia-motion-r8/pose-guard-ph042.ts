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

/** Stricter presentation when legs and hips are visible in full-body view.
 * The raw VRM0/FBX retarget has not been fully validated in the user's ASUS.
 * Smaller upper-body deltas and bounded leg joints avoid exaggerated poses.
 */
export const R8_FULL_BODY_LIMITS = Object.freeze({
  leftShoulder: [0.12, 0.30], rightShoulder: [0.12, 0.30],
  leftUpperArm: [0.22, 0.65], rightUpperArm: [0.22, 0.65],
  leftLowerArm: [0.30, 0.75], rightLowerArm: [0.30, 0.75],
  leftHand: [0.24, 0.55], rightHand: [0.24, 0.55],
  spine: [0.09, 0.20], chest: [0.12, 0.24],
  upperChest: [0.10, 0.22], hips: [0.08, 0.16],
  leftUpperLeg: [0.14, 0.40], rightUpperLeg: [0.14, 0.40],
  leftLowerLeg: [0.18, 0.47], rightLowerLeg: [0.18, 0.47],
  leftFoot: [0.13, 0.30], rightFoot: [0.13, 0.30],
  leftToes: [0.08, 0.20], rightToes: [0.08, 0.20],
} as const)

/**
 * PH-04.7: only two owner-observed clips need a less restrictive envelope.
 * The ordinary R8 safe pose remains unchanged for the other fifteen FBX.
 *
 * Clapping needs the upper arms to meet at the body's center. These are
 * angular limits, NOT a promise of palm contact: local FBX skinning and
 * retarget must still be checked on ASUS.
 */
export const R8_AUTHORED_GESTURE_LIMITS = Object.freeze({
  clapping: Object.freeze({
    leftShoulder: [0.50, 0.90], rightShoulder: [0.50, 0.90],
    leftUpperArm: [1.35, 1.85], rightUpperArm: [1.35, 1.85],
    leftLowerArm: [1.65, 2.15], rightLowerArm: [1.65, 2.15],
    leftHand: [0.85, 1.20], rightHand: [0.85, 1.20],
  }),
  no: Object.freeze({
    leftShoulder: [0.30, 0.46], rightShoulder: [0.30, 0.46],
    leftUpperArm: [0.44, 0.88], rightUpperArm: [0.44, 0.88],
    leftLowerArm: [0.54, 0.95], rightLowerArm: [0.54, 0.95],
  }),
} as const)

/** True if the original FBX pose was beyond the conservative envelope. */
export function boundR8BodyPose(
  bones: Map<string, THREE.Object3D>,
  procedural: Map<string, THREE.Quaternion>,
  manual: boolean,
  fullBody = false,
  clipId: string | null = null,
): number {
  let corrected = 0
  const limitsForView = fullBody ? R8_FULL_BODY_LIMITS : R8_POSE_LIMITS
  const authored = (manual && clipId && Object.hasOwn(R8_AUTHORED_GESTURE_LIMITS, clipId))
    ? R8_AUTHORED_GESTURE_LIMITS[clipId as keyof typeof R8_AUTHORED_GESTURE_LIMITS]
    : null
  for (const [name, limits] of Object.entries(limitsForView)) {
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
    const gesture = authored && Object.prototype.hasOwnProperty.call(authored, name)
      ? (authored as unknown as Record<string, readonly [number, number]>)[name]
      : null
    // Only loosen the target joint, never weaken torso / hips / legs.
    const max = gesture ? gesture[manual ? 1 : 0] : limits[manual ? 1 : 0]
    if (angle > max) {
      const target = q.clone()
      q.copy(base).slerp(target, max / angle).normalize()
      corrected++
    }
  }
  return corrected
}
