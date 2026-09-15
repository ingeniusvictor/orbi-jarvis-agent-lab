import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import type { Drive } from './Scene'

const MODEL_URL = '/models/lumia/lumia.glb'

type Prepared = {
  object: THREE.Group
  reactive: THREE.MeshStandardMaterial[]
  center: THREE.Vector3
  height: number
}

/**
 * The GLB's geometric bounds are not its visual centre. The antenna extends
 * much farther upward than the little feet extend downward, so centring the
 * whole bounding box leaves the round body visibly low inside the reactor.
 *
 * Measured on the current lightweight L.U.M.I.A. asset, the main spherical
 * body is centred about 9.5% of the model height below the bounds centre.
 * Lifting by that amount aligns the face/body with the reactor rather than
 * aligning the antenna + appendages as one silhouette.
 */
const OPTICAL_LIFT = 0.095

function cloneMaterial(
  material: THREE.Material,
  reactive: THREE.MeshStandardMaterial[],
): THREE.Material {
  const clone = material.clone()

  if (clone instanceof THREE.MeshStandardMaterial) {
    // Preserve the authored maps while giving the model enough internal light
    // to read as part of the reactor instead of as a normal opaque 3D asset.
    clone.emissive = new THREE.Color('#0b3d42')
    clone.emissiveIntensity = 0.34
    clone.metalness = Math.max(0.22, clone.metalness)
    clone.roughness = Math.min(0.58, clone.roughness)
    reactive.push(clone)
  }

  return clone
}

/**
 * First L.U.M.I.A. avatar prototype.
 *
 * The supplied GLB is already centred in X/Z and spans Y=0..1, so it only
 * needs a responsive scale plus a half-height offset to sit exactly in the
 * reactor. No rig or animation clips are required for this pass.
 *
 * Motion deliberately stays subtle: a tiny float and yaw sweep are enough to
 * prove the model is genuinely three-dimensional without turning the assistant
 * into a continuously spinning product viewer.
 */
export function LumiaAvatar({ drive }: { drive: Drive }) {
  const root = useRef<THREE.Group>(null)
  const motionStartedAt = useRef<number | null>(null)
  const { scene } = useGLTF(MODEL_URL)
  const viewport = useThree((s) => s.viewport)

  const prepared = useMemo<Prepared>(() => {
    const reactive: THREE.MeshStandardMaterial[] = []
    const object = scene.clone(true)

    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return

      child.frustumCulled = false
      child.castShadow = false
      child.receiveShadow = false

      child.material = Array.isArray(child.material)
        ? child.material.map((material) => cloneMaterial(material, reactive))
        : cloneMaterial(child.material, reactive)
    })

    const box = new THREE.Box3().setFromObject(object)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    return {
      object,
      reactive,
      center,
      height: Math.max(size.y, 0.001),
    }
  }, [scene])

  useFrame((state, dt) => {
    if (!root.current) return

    const fit = Math.min(viewport.width, viewport.height)
    const targetHeight = fit * 0.45
    const modelScale = targetHeight / prepared.height
    const t = state.clock.elapsedTime
    const phase = useStore.getState().phase

    // The first reveal and spoken introduction stay perfectly frontal. The
    // idle personality begins only after L.U.M.I.A. reaches standby for the
    // first time, then eases in over four seconds rather than snapping into a
    // tilted pose.
    if (phase === 'dormant' && motionStartedAt.current === null) {
      motionStartedAt.current = t
    }
    const motionAge =
      motionStartedAt.current === null ? 0 : Math.max(0, t - motionStartedAt.current)
    const motionBlend = THREE.MathUtils.smoothstep(
      THREE.MathUtils.clamp(motionAge / 4, 0, 1),
      0,
      1,
    )

    const floatAmount =
      phase === 'speaking' ? 0.038 : phase === 'thinking' ? 0.030 : 0.022
    const voicePulse = 1 + drive.level * 0.012

    const poseMotion =
      phase === 'dormant'
        ? 1
        : phase === 'listening'
          ? 0.55
          : phase === 'speaking'
            ? 0.40
            : phase === 'thinking' || phase === 'tooling'
              ? 0.22
              : 0

    root.current.scale.setScalar(modelScale * voicePulse)
    root.current.position.set(
      0,
      Math.sin(t * 0.82) * floatAmount,
      0.12,
    )

    // A presence, not a turntable: once idle motion is enabled the maximum yaw
    // is only about five degrees. Pitch and roll are barely perceptible.
    root.current.rotation.x =
      Math.sin(t * 0.31) * 0.008 * motionBlend * poseMotion
    root.current.rotation.y =
      Math.sin(t * 0.24) * 0.055 * motionBlend * poseMotion
    root.current.rotation.z =
      Math.sin(t * 0.19) * 0.004 * motionBlend * poseMotion

    // Let L.U.M.I.A.'s own surfaces breathe with the same accent/audio energy
    // as the surrounding hologram.
    const targetIntensity = 0.28 + drive.level * 0.75
    for (const material of prepared.reactive) {
      material.emissive.lerp(drive.reactor.color, Math.min(1, dt * 3))
      material.emissiveIntensity +=
        (targetIntensity - material.emissiveIntensity) * Math.min(1, dt * 5)
    }
  })

  return (
    <group ref={root}>
      <group
        position={[
          -prepared.center.x,
          -prepared.center.y + prepared.height * OPTICAL_LIFT,
          -prepared.center.z,
        ]}
      >
        <primitive object={prepared.object} />
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_URL)
