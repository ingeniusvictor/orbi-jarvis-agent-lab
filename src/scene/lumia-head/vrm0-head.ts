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
}

/**
 * PH-01 is intentionally a VRM 0.x adapter for the *approved* Lumia asset.
 * No destructive export and no redundant Three.js / WebGL runtime.
 *
 * A GLTFLoader reads the VRM0 file as glTF and keeps skinning/morph targets.
 * This adapter interprets the VRM0 humanoid and blendShapeMaster metadata.
 * It is a reversible POC; advanced VRM springbones/MToon are not yet enabled.
 */
export function prepareLumiaHead(gltf: GLTF): HeadRig {
  const parser = gltf.parser as unknown as ParserInfo
  const vrm = parser.json?.extensions?.VRM
  if (!vrm) throw new Error('LUMIA PH01: se esperaba un VRM 0.x con extensión VRM.')
  const associations = parser.associations
  const nodes = new Map<number, THREE.Object3D>()
  const meshes = new Map<number, THREE.Mesh[]>()
  const visibleMeshes: THREE.Mesh[] = []

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

    // Hide mesh material only. Leave Body bones, skin bindings and hierarchy intact.
    mesh.visible = sourceMesh === 0 || sourceMesh === 2
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
    expressions, meshes, visibleMeshes,
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
