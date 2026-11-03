import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'

type VrmBind = { mesh: number; index: number; weight?: number }
type VrmGroup = { name?: string; presetName?: string; binds?: VrmBind[] }
type VrmBone = { bone: string; node: number }
type Vrm0Ext = {
  humanoid?: { humanBones?: VrmBone[] }
  blendShapeMaster?: { blendShapeGroups?: VrmGroup[] }
}
type ParserInfo = {
  json?: { extensions?: { VRM?: Vrm0Ext }; nodes?: Array<{ name?: string }> }
  associations?: Map<THREE.Object3D, { meshes?: number; nodes?: number }>
}

export type HeadRig = {
  scene: THREE.Group
  head: THREE.Object3D | null
  neck: THREE.Object3D | null
  leftEye: THREE.Object3D | null
  rightEye: THREE.Object3D | null
  expressions: Map<string, VrmBind[]>
  meshes: Map<number, THREE.Mesh[]>
  visibleMeshes: THREE.Mesh[]
  neckClipPlane: THREE.Plane | null
  neckMeshes: THREE.Mesh[]
  bodyBones: Map<string, THREE.Object3D>
}

/**
 * PH-01 is intentionally a VRM 0.x adapter for the *approved* Lumia asset.
 * No destructive export and no redundant Three.js / WebGL runtime.
 *
 * A GLTFLoader reads the VRM0 file as glTF and keeps skinning/morph targets.
 * This adapter interprets the VRM0 humanoid and blendShapeMaster metadata.
 * It is a reversible POC; advanced VRM springbones/MToon are not yet enabled.
 */
export function prepareLumiaHead(gltf: GLTF, options: { ph02?: boolean; showNeck?: boolean; showBody?: boolean } = {}): HeadRig {
  const parser = gltf.parser as unknown as ParserInfo
  const vrm = parser.json?.extensions?.VRM
  if (!vrm) throw new Error('LUMIA PH01: se esperaba un VRM 0.x con extensión VRM.')
  const associations = parser.associations
  const nodes = new Map<number, THREE.Object3D>()
  const meshes = new Map<number, THREE.Mesh[]>()
  const visibleMeshes: THREE.Mesh[] = []
  // Optional, non-destructive neck preview: only a clipped section of the
  // original Body mesh; no synthetic neck or VRM re-export.
  const neckClipPlane = options.showNeck ? new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.4) : null
  const neckMeshes: THREE.Mesh[] = []

  gltf.scene.traverse((node) => {
    const association = associations?.get(node)
    if (typeof association?.nodes === 'number') nodes.set(association.nodes, node)
    const mesh = node as THREE.Mesh
    if (!(mesh as THREE.Mesh & { isMesh?: boolean }).isMesh) return

    const sourceMesh =
      typeof association?.meshes === 'number'
        ? association.meshes
        : /Face/i.test(mesh.name) || /Face/i.test(mesh.parent?.name ?? '') ? 0
          : /Hair/i.test(mesh.name) || /Hair/i.test(mesh.parent?.name ?? '') ? 2 : 1

    const list = meshes.get(sourceMesh) ?? []
    list.push(mesh)
    meshes.set(sourceMesh, list)

    // Preserve the original glTF skeleton and material maps. Only clone
    // materials in the PH-02 visual preview; the original VRM is untouched.
    const neckBody = Boolean(neckClipPlane && sourceMesh === 1 &&
      /(?:body|skin|neck)/i.test(mesh.name + ' ' + (mesh.parent?.name ?? '')))
    mesh.visible = sourceMesh === 0 || sourceMesh === 2 || neckBody || Boolean(options.showBody)
    if (mesh.visible && options.ph02) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const clones = materials.map((original) => {
        const clone = original.clone()
        const surface = clone as THREE.MeshStandardMaterial
        if (surface.color instanceof THREE.Color) {
          surface.color.multiplyScalar(sourceMesh === 0 ? 0.84 : sourceMesh === 2 ? 0.73 : 0.88)
        }
        if (surface.emissive instanceof THREE.Color) {
          surface.emissive.multiplyScalar(0.60)
          surface.emissiveIntensity *= 0.65
        }
        if (neckBody && neckClipPlane) {
          clone.clippingPlanes = [neckClipPlane]
          clone.clipShadows = true
        }
        return clone
      })
      mesh.material = Array.isArray(mesh.material) ? clones : clones[0]
    }
    if (neckBody) neckMeshes.push(mesh)
    mesh.frustumCulled = false
    if (mesh.visible) {
      mesh.castShadow = false
      mesh.receiveShadow = false
      visibleMeshes.push(mesh)
    }
  })

  if (!(meshes.get(0)?.length) || !(meshes.get(2)?.length)) {
    throw new Error('LUMIA PH01: no se encontraron las mallas Face y Hair.')
  }

  const bone = (name: string): THREE.Object3D | null => {
    const ref = vrm.humanoid?.humanBones?.find((entry) => entry.bone === name)
    if (!ref) return null
    return nodes.get(ref.node)
      ?? gltf.scene.getObjectByName(parser.json?.nodes?.[ref.node]?.name ?? '')
      ?? null
  }
  const bodyBones = new Map<string, THREE.Object3D>()
  const names = [
    'hips','spine','chest','upperChest','neck','head',
    'leftShoulder','leftUpperArm','leftLowerArm','leftHand',
    'rightShoulder','rightUpperArm','rightLowerArm','rightHand',
    'leftUpperLeg','leftLowerLeg','leftFoot','leftToes',
    'rightUpperLeg','rightLowerLeg','rightFoot','rightToes',
  ]
  for (const name of names) {
    const node = bone(name)
    if (node) bodyBones.set(name, node)
  }

  const expressions = new Map<string, VrmBind[]>()
  for (const group of vrm.blendShapeMaster?.blendShapeGroups ?? []) {
    const key = (group.presetName && group.presetName !== 'unknown'
      ? group.presetName : group.name ?? '').toLowerCase()
    if (key) expressions.set(key, group.binds ?? [])
    if (group.name) expressions.set(group.name.toLowerCase(), group.binds ?? [])
  }

  // Animated face and hair remain in the same original skinned hierarchy.
  return {
    scene: gltf.scene, head: bone('head'), neck: bone('neck'),
    leftEye: bone('leftEye'), rightEye: bone('rightEye'),
    expressions, meshes, visibleMeshes, neckClipPlane, neckMeshes, bodyBones,
  }
}

/** Update only face morphs. Other body resources remain untouched. */
export function setHeadExpressions(rig: HeadRig, values: Record<string, number>): void {
  for (const mesh of rig.meshes.get(0) ?? []) {
    if (mesh.morphTargetInfluences) mesh.morphTargetInfluences.fill(0)
  }

  for (const [name, rawValue] of Object.entries(values)) {
    const binds = rig.expressions.get(name.toLowerCase())
    if (!binds) continue
    const value = THREE.MathUtils.clamp(rawValue, 0, 1)
    if (value < 0.001) continue
    for (const bind of binds) {
      const amount = value * THREE.MathUtils.clamp((bind.weight ?? 100) / 100, 0, 1)
      for (const mesh of rig.meshes.get(bind.mesh) ?? []) {
        const morphs = mesh.morphTargetInfluences
        if (!morphs || bind.index < 0 || bind.index >= morphs.length) continue
        morphs[bind.index] = Math.max(morphs[bind.index], amount)
      }
    }
  }
}

/** Deterministic, deliberately labeled approximate vowel-cue fallback. */
export function approximateVowel(text: string, elapsedSeconds: number): 'a' | 'e' | 'i' | 'o' | 'u' {
  const source = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const vowels = source.match(/[aeiou]/g) ?? ['a', 'e', 'i', 'o', 'u']
  return vowels[Math.floor(Math.max(0, elapsedSeconds) * 8.4) % vowels.length] as 'a' | 'e' | 'i' | 'o' | 'u'
}
