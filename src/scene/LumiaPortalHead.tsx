import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as THREE from 'three'
import { useStore } from '../store'
import { R8BodyCompanion, isR8BodyMode, isR8ClipEnabled } from './lumia-motion-r8/portal-body-companion'
import type { Drive } from './Scene'
import {
  approximateVowel, prepareLumiaHead, setHeadExpressions,
} from './lumia-head/vrm0-head'
import {
  isPh02Presentation, isNeckPreviewEnabled, calculateHeadMotion,
} from './lumia-head/head-presentation-ph02'
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
const HEAD_FRACTION_PH01 = 0.54
const HEAD_FRACTION_PH02 = 0.70
const BUST_HEIGHT_M = 1.10
const BODY_HEIGHT_M = 1.94

type SpeechState = {
  active: boolean
  id: string | null
  text: string
  phraseStarted: number
}

export function LumiaPortalHead({ drive }: { drive: Drive }) {
  const root = useRef<THREE.Group>(null)
  const pivot = useRef<THREE.Group>(null)
  const ph02 = isPh02Presentation(window.location.search)
  const showNeck = isNeckPreviewEnabled(window.location.search)
  const showBody = isR8BodyMode(window.location.search)
  const clipEnabled = isR8ClipEnabled(window.location.search)
  const avatarMode = new URLSearchParams(window.location.search).get('lumiaAvatar')
  const fullBody = avatarMode === 'body-vrm'
  const bust = avatarMode === 'bust-vrm'
  const centerY = fullBody ? 0.99 : bust ? 1.28 : HEAD_CENTER_Y
  const gltf = useLoader(GLTFLoader, VRM_URL)
  const rig = useMemo(
    () => prepareLumiaHead(gltf, { ph02, showNeck, showBody }),
    [gltf, ph02, showNeck, showBody],
  )
  const body = useMemo(
    () => showBody ? new R8BodyCompanion(rig, { allowClips: clipEnabled }) : null,
    [rig, showBody, clipEnabled],
  )
  useEffect(() => () => { body?.dispose() }, [body])
  const viewport = useThree((state) => state.viewport)
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    if (!showNeck) return
    const previous = gl.localClippingEnabled
    gl.localClippingEnabled = true
    return () => { gl.localClippingEnabled = previous }
  }, [gl, showNeck])
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
        body?.onSpokenPhrase(data.text)
      } else if (data.kind === 'end' && speech.current.id === data.turnId) {
        speech.current.active = false
        speech.current.text = ''
        body?.onSpeechEnd()
      }
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener(LUMIA_PORTAL_SPEECH_EVENT, voiceEvent)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener(LUMIA_PORTAL_SPEECH_EVENT, voiceEvent)
    }
  }, [body])

  useFrame((state, dt) => {
    if (!root.current) return
    const t = state.clock.elapsedTime
    const phase = useStore.getState().phase
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 6)
    const speakingAudio = speech.current.active

    // Independent optics: portrait, conversational bust and full-body
    // companion share the SAME avatar rig and same Portal/HUD/TTS stack.
    const fit = Math.min(viewport.width, viewport.height)
    const fraction = fullBody ? .84 : bust ? .70
      : (ph02 ? HEAD_FRACTION_PH02 : HEAD_FRACTION_PH01)
    const height = fullBody ? BODY_HEIGHT_M : bust ? BUST_HEIGHT_M : HEAD_HEIGHT_M
    const scale = fit * fraction / height * (1 + drive.level * 0.005)
    root.current.scale.setScalar(scale)
    root.current.position.set(
      0, Math.sin(t * 0.68) * 0.012 + (showBody ? -0.018 : ph02 ? -0.035 : 0), 0.12,
    )
    // Optional reveal uses the authentic body/neck mesh, clipped before the
    // shoulder. The clipping plane follows responsive scene scale.
    if (rig.neckClipPlane) {
      const clipY = root.current.position.y + (1.12 - HEAD_CENTER_Y) * scale
      rig.neckClipPlane.constant = -clipY
    }

    // Eye-following and expressive head motions are independent from body FBX.
    const attention = phase === 'listening' ? 1 : phase === 'thinking' ? 0.65 : 0.50
    const px = pointer.current.x
    const py = pointer.current.y
    const motion = calculateHeadMotion({ x: px, y: py, phase, seconds: t })
    const semantic = body?.step(dt, phase, speakingAudio)
    const headYaw = (ph02 ? motion.headYaw
      : -px * 0.095 * attention + Math.sin(t * 0.21) * 0.018) +
      (semantic?.head.yaw ?? 0)
    const headPitch = (ph02 ? motion.headPitch
      : py * 0.052 * attention + (phase === 'thinking' ? -0.028 : 0)) +
      (semantic?.head.pitch ?? 0)
    const eyeYaw = ph02 ? motion.eyeYaw : -px * 0.20
    const eyePitch = ph02 ? motion.eyePitch : py * 0.13
    const applyBone = (node: THREE.Object3D | null, yaw: number, pitch: number, roll = 0) => {
      if (!node) return
      const base = bones.get(node)
      if (!base) return
      temp.euler.set(pitch, yaw, roll, 'YXZ')
      temp.delta.setFromEuler(temp.euler)
      temp.desired.copy(base).multiply(temp.delta)
      node.quaternion.slerp(temp.desired, k)
    }
    if (showBody) {
      // Body R8 controls torso and arms; facial bones remain independent.
      // Rotate the actual head/neck gently and leave only a small whole-rig
      // motion to the face-centred pivot, preventing stiff puppet movement.
      applyBone(rig.head, headYaw * 0.88, headPitch * 0.85,
        motion.roll + (semantic?.head.roll ?? 0))
      applyBone(rig.neck, headYaw * 0.16, headPitch * 0.16)
      if (pivot.current) {
        temp.euler.set(headPitch * .12, headYaw * .12, motion.roll * .25, 'YXZ')
        temp.delta.setFromEuler(temp.euler)
        pivot.current.quaternion.slerp(temp.delta, k)
      }
    } else if (ph02 && pivot.current) {
      // Original PH-02 portrait movement remains unchanged.
      temp.euler.set(headPitch, headYaw, motion.roll, 'YXZ')
      temp.delta.setFromEuler(temp.euler)
      pivot.current.quaternion.slerp(temp.delta, k)
    } else {
      applyBone(rig.head, headYaw, headPitch, Math.sin(t * .18) * 0.012)
      applyBone(rig.neck, headYaw * 0.14, headPitch * 0.12)
    }
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
      <group ref={pivot}>
        <group rotation={[0, Math.PI, 0]} position={[0, -centerY, 0]}>
          <primitive object={rig.scene} />
        </group>
      </group>
    </group>
  )
}
