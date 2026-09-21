import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { MODEL_GROUPS } from './venue'

/**
 * Loads haveli-stage.obj as drawn, swaps its flat previz materials for ones
 * that take light, and gives the LED face planar UVs (the OBJ has none): u
 * runs house-left → house-right, v bottom → top, so a picture authored at
 * 10240 × 1920 lands on the wall 1:1.
 */
export type Model = Awaited<ReturnType<typeof loadModel>>

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o })

export async function loadModel() {
  const mtl = await new MTLLoader().setPath('/').loadAsync('haveli-stage.mtl')
  mtl.preload()
  const obj = await new OBJLoader().setMaterials(mtl).setPath('/').loadAsync('haveli-stage.obj')

  const mats: Record<string, THREE.Material> = {
    deck: std({ color: 0x2a2f36, roughness: 0.85, metalness: 0.05 }),
    carpet: std({ color: 0x3b3531, roughness: 0.95 }),
    wall: std({ color: 0x8f8778, roughness: 0.9 }),
    cordon: std({ color: 0x8a8270, roughness: 0.8 }),
    led_body: std({ color: 0x0b0d10, roughness: 0.45, metalness: 0.55 }),
    drape: std({ color: 0x120f0d, roughness: 1 }),
    cabin: std({ color: 0xd9d2c3, roughness: 0.7 }),
    glass: std({ color: 0x9fc4d8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false }),
    chair: std({ color: 0x8c4a3c, roughness: 0.85 }),
  }
  /** The LED with nothing on it: a dark glossy slab. */
  const ledBase = std({ color: 0x0c1018, roughness: 0.35, metalness: 0.3, emissive: new THREE.Color(0x0a1220) })

  const groups: Record<string, THREE.Group> = {}
  for (const g of MODEL_GROUPS) { groups[g.id] = new THREE.Group(); groups[g.id].name = g.id }
  const root = new THREE.Group()
  root.name = 'haveli-stage'
  for (const g of Object.values(groups)) root.add(g)

  let led: THREE.Mesh | null = null
  const meshes: THREE.Mesh[] = []
  const list = [...obj.children]
  for (const o of list) {
    if (!(o as THREE.Mesh).isMesh) continue
    const m = o as THREE.Mesh
    const mtlName = (m.material as THREE.Material)?.name ?? ''
    if (m.name === 'led_surface') {
      // planar UVs over the face: u across x, v up y
      const p = m.geometry.getAttribute('position')
      const bb = new THREE.Box3().setFromBufferAttribute(p as THREE.BufferAttribute)
      const uv: number[] = []
      for (let i = 0; i < p.count; i++) uv.push((p.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y))
      m.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      m.material = ledBase
      m.userData.baseMat = ledBase
      led = m
    } else {
      m.material = mats[mtlName] ?? std({ color: 0x777777 })
      m.castShadow = !mtlName.startsWith('glass') && !m.name.startsWith('hall_')
      m.receiveShadow = true
    }
    m.frustumCulled = false
    const g = MODEL_GROUPS.find((x) => x.match(m.name))
    ;(g ? groups[g.id] : root).add(m)
    meshes.push(m)
  }
  if (!led) throw new Error('haveli-stage.obj has no led_surface')

  return { root, groups, led: led as THREE.Mesh, ledBase, meshes, mats: [...Object.values(mats), ledBase] }
}
