import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as THREE from 'three'
import { useStore } from '../store'
import type { Drive } from './Scene'
import {
  approximateVowel, prepareLumiaHead, setHeadExpressions,
} from './lumia-head/vrm0-head'
import {
  LUMIA_PORTAL_SPEECH_EVENT, type PortalSpeechEvent,
} from './lumia-head/portal-speech-events'

/**
 * PH-01 — interactive HEAD-only proof of concept.
 * Place LUMIA_VITA_NATURAL_V05.vrm locally at the path below.
 * This is never shipped to the PUBLIC GitHub repository.
 */
const VRM_URL = '/models/lumia-motion/LUMIA_VITA_NATURAL_V05.vrm'
const HEAD_CENTER_Y = 1.54 // measured on the user's approved VRM
const HEAD_HEIGHT_M = 0.59 // optical face/hair framing; user can tune after QA
const HEAD_FRACTION = 0.54

type SpeechState = {
  active: boolean
  id: string | null
  text: string
  phraseStarted: number
}

export function LumiaPortalHead({ drive }: { drive: Drive }) {
  const root = useRef<THREE.Group>(null)
  const gltf = useLoader(GLTFLoader, VRM_URL)
  const rig = useMemo(() => prepareLumiaHead(gltf), [gltf])
  const { viewport, size } = useThree()
  const pointer = useRef({ x: 0, y: 0 })
  const speech = useRef<SpeechState>({
    active: false, id: null, text: '', phraseStarted: 0,
  })

  const bones = useMemo(() => {
    const base = new Map<THREE.Object3D, THREE.Quaternion>()
    for (const node of [rig.head, rig.neck, rig.leftEye, rig.rightEye]) {
      if (node) base.set(node, node.quaternion.clone())
    }
    return base
  }, [rig])

  const temp = useMemo(() => ({
    euler: new THREE.Euler(0, 0, 0, 'YXZ'),
    delta: new THREE.Quaternion(),
    desired: new THREE.Quaternion(),
  }), [])

  useEffect(() => {
    const move = (event: PointerEvent) => {
      pointer.current.x = THREE.MathUtils.clamp(
        (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1, -1, 1,
      )
      pointer.current.y = THREE.MathUtils.clamp(
        1 - (event.clientY / Math.max(1, window.innerHeight)) * 2, -1, 1,
      )
    }
    const voiceEvent = (event: Event) => {
      const data = (event as CustomEvent<PortalSpeechEvent>).detail
      if (!data) return
      if (data.kind === 'start') {
        speech.current = {
          active: true, id: data.turnId, text: '',
          phraseStarted: performance.now() / 1000,
        }
      } else if (data.kind === 'phrase') {
        if (!speech.current.active || speech.current.id !== data.turnId) return
        speech.current.text = data.text
        speech.current.phraseStarted = performance.now() / 1000
      } else if (data.kind === 'end' && speech.current.id === data.turnId) {
        speech.current.active = false
        speech.current.text = ''
      }
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener(LUMIA_PORTAL_SPEECH_EVENT, voiceEvent)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener(LUMIA_PORTAL_SPEECH_EVENT, voiceEvent)
    }
  }, [])

  useFrame((state, dt) => {
    if (!root.current) return
    const t = state.clock.elapsedTime
    const phase = useStore.getState().phase
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 6)
    const speakingAudio = speech.current.active

    // The original ring and camera are left untouched.
    const fit = Math.min(viewport.width, viewport.height)
    root.current.scale.setScalar(
      (fit * HEAD_FRACTION / HEAD_HEIGHT_M) * (1 + drive.level * 0.005),
    )
    root.current.position.set(
      0, Math.sin(t * 0.68) * 0.012, 0.12,
    )

    // Eye-following and expressive head motions are independent from body FBX.
    const attention = phase === 'listening' ? 1 : phase === 'thinking' ? 0.65 : 0.50
    const px = pointer.current.x
    const py = pointer.current.y
    const headYaw = -px * 0.095 * attention + Math.sin(t * 0.21) * 0.018
    const headPitch = py * 0.052 * attention + (phase === 'thinking' ? -0.028 : 0)
    const eyeYaw = -px * 0.20
    const eyePitch = py * 0.13
    const applyBone = (node: THREE.Object3D | null, yaw: number, pitch: number, roll = 0) => {
      if (!node) return
      const base = bones.get(node)
      if (!base) return
      temp.euler.set(pitch, yaw, roll, 'YXZ')
      temp.delta.setFromEuler(temp.euler)
      temp.desired.copy(base).multiply(temp.delta)
      node.quaternion.slerp(temp.desired, k)
    }
    applyBone(rig.head, headYaw, headPitch, Math.sin(t * .18) * 0.012)
    applyBone(rig.neck, headYaw * 0.14, headPitch * 0.12)
    applyBone(rig.leftEye, eyeYaw, eyePitch)
    applyBone(rig.rightEye, eyeYaw, eyePitch)

    // VRM0 expression blends are owned by this head renderer only.
    const cycle = t % 3.73
    const blink = Math.exp(-Math.pow((cycle - 3.57) / 0.046, 2))
    const values: Record<string, number> = { blink }
    if (speakingAudio) {
      const elapsed = Math.max(0, performance.now() / 1000 - speech.current.phraseStarted)
      const vowel = approximateVowel(speech.current.text, elapsed)
      values[vowel] = 0.18 + 0.48 * Math.abs(Math.sin(elapsed * 9.8))
    }
    if (phase === 'thinking' || phase === 'tooling') values.fun = 0.09
    if (speakingAudio) values.joy = 0.05
    setHeadExpressions(rig, values)
  })

  return (
    <group ref={root}>
      <group rotation={[0, Math.PI, 0]} position={[0, -HEAD_CENTER_Y, 0]}>
        <primitive object={rig.scene} />
      </group>
    </group>
  )
}
