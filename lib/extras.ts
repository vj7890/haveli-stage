import * as THREE from 'three'
import { CABIN, HALL, LED, STAGE } from './venue'

/** A canvas-sprite label pinned in the room. */
export function label(group: THREE.Group, text: string, x: number, y: number, z: number, tint = '#9cd8ff') {
  const c = document.createElement('canvas')
  const g = c.getContext('2d')!
  g.font = '600 26px Onest, Inter, system-ui, sans-serif'
  const w = Math.ceil(g.measureText(text).width) + 28
  c.width = w; c.height = 44
  g.font = '600 26px Onest, Inter, system-ui, sans-serif'
  g.fillStyle = 'rgba(8,10,14,0.85)'
  g.beginPath(); g.roundRect(0, 0, w, 44, 10); g.fill()
  g.fillStyle = tint; g.textBaseline = 'middle'; g.fillText(text, 14, 23)
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false, toneMapped: false }))
  sp.scale.set(w / 2900, 44 / 2900, 1)
  sp.position.set(x, y, z)
  sp.renderOrder = 20
  group.add(sp)
}

/** An arrowed dimension between two points, its length (or a caption) at the middle. */
export function dim(group: THREE.Group, A: [number, number, number], B: [number, number, number], text?: string, tint = '#9cd8ff') {
  const a = new THREE.Vector3(...A), b = new THREE.Vector3(...B)
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const len = a.distanceTo(b)
  const col = new THREE.Color(tint).getHex()
  for (const end of [a, b]) {
    const dir = end.clone().sub(mid).normalize()
    const ah = new THREE.ArrowHelper(dir, mid, len / 2, col, Math.min(0.45, len * 0.12), Math.min(0.22, len * 0.06))
    ;(ah.line.material as THREE.Material).depthTest = false
    ;(ah.cone.material as THREE.Material).depthTest = false
    ah.renderOrder = 19
    group.add(ah)
  }
  label(group, text ?? `${Math.round(len * 100) / 100} m`, mid.x, mid.y, mid.z, tint)
}

/** The numbers that matter, drawn on the model. */
export function buildSizes() {
  const g = new THREE.Group()
  const R = '#ff8a5a', G = '#5ee0a0', B = '#9cd8ff', Y = '#ffd166'
  const zf = LED.z + 0.3
  // the LED, in orange
  dim(g, [LED.x[0], LED.y[1] + 0.5, zf], [LED.x[1], LED.y[1] + 0.5, zf], `LED ${LED.w} m · ${LED.px[0]} px`, R)
  dim(g, [LED.x[1] + 0.5, LED.y[0], zf], [LED.x[1] + 0.5, LED.y[1], zf], `${LED.h} m · ${LED.px[1]} px`, R)
  dim(g, [LED.x[0] - 0.9, 0, zf], [LED.x[0] - 0.9, LED.y[0], zf], `bottom +${LED.y[0]} m`, Y)
  dim(g, [LED.x[0] - 0.9, LED.y[1], zf], [LED.x[0] - 0.9, HALL.wallH, zf], `${(HALL.wallH - LED.y[1]).toFixed(2)} m to the wall top`, Y)
  // the cabin
  dim(g, [CABIN.x[0], CABIN.y[1] + 0.35, CABIN.z[1]], [CABIN.x[1], CABIN.y[1] + 0.35, CABIN.z[1]], `cabin ${(CABIN.x[1] - CABIN.x[0]).toFixed(2)} m`, G)
  dim(g, [CABIN.x[1] + 0.35, CABIN.y[0], CABIN.z[1]], [CABIN.x[1] + 0.35, CABIN.y[1], CABIN.z[1]], `${(CABIN.y[1] - CABIN.y[0]).toFixed(2)} m`, G)
  dim(g, [CABIN.x[1] + 0.35, CABIN.y[1] + 0.35, CABIN.z[0]], [CABIN.x[1] + 0.35, CABIN.y[1] + 0.35, CABIN.z[1]], `${(CABIN.z[1] - CABIN.z[0]).toFixed(2)} m deep`, G)
  // the stage
  dim(g, [-STAGE.frontW / 2, STAGE.deckH + 0.12, 0.3], [STAGE.frontW / 2, STAGE.deckH + 0.12, 0.3], `stage front ${STAGE.frontW} m`, B)
  dim(g, [-STAGE.midW / 2 - 0.6, 0, -2.4], [-STAGE.midW / 2 - 0.6, STAGE.deckH, -2.4], `deck +${STAGE.deckH} m`, B)
  dim(g, [STAGE.midW / 2 + 0.6, STAGE.deckH + 0.12, 0], [STAGE.midW / 2 + 0.6, STAGE.deckH + 0.12, -STAGE.depth], `${STAGE.depth} m to the back wall`, B)
  dim(g, [-STAGE.foreW / 2, STAGE.foreH + 0.12, STAGE.foreD + 0.3], [STAGE.foreW / 2, STAGE.foreH + 0.12, STAGE.foreD + 0.3], `forestage ${STAGE.foreW} m`, B)
  dim(g, [STAGE.foreW / 2 + 0.5, STAGE.foreH + 0.12, 0], [STAGE.foreW / 2 + 0.5, STAGE.foreH + 0.12, STAGE.foreD], `${STAGE.foreD} m · +${STAGE.foreH}`, B)
  // the room
  dim(g, [-HALL.w / 2, HALL.wallH + 0.4, HALL.floorZ[0]], [HALL.w / 2, HALL.wallH + 0.4, HALL.floorZ[0]], `hall ${HALL.w} m`, Y)
  dim(g, [HALL.w / 2 + 0.6, 0, HALL.floorZ[0] + 4], [HALL.w / 2 + 0.6, HALL.wallH, HALL.floorZ[0] + 4], `walls ${HALL.wallH} m`, Y)
  g.visible = false
  return g
}

/** 1.75 m people, so the set reads at human size: one on stage, one on the forestage, one on the floor. */
export function buildFigures() {
  const g = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color: 0xc9a07c, roughness: 0.75 })
  const cloth = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.9 })
  const cloth2 = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.9 })
  const limb = (a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) => {
    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, 10), m)
    o.position.copy(a).add(b).multiplyScalar(0.5)
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    o.castShadow = o.receiveShadow = true
    g.add(o)
  }
  const standing = (x: number, z: number, base: number, m: THREE.Material) => {
    const V = (xx: number, h: number, zz: number) => new THREE.Vector3(xx, h, zz)
    const hip = base + 0.93, shoulder = base + 1.44
    limb(V(x, hip, z), V(x, shoulder, z), 0.14, m)
    limb(V(x, shoulder, z), V(x, shoulder + 0.06, z), 0.05, skin)
    for (const s of [-1, 1]) {
      limb(V(x + s * 0.1, hip, z), V(x + s * 0.1, base + 0.04, z), 0.07, m)
      limb(V(x + s * 0.2, shoulder - 0.03, z), V(x + s * 0.23, hip - 0.03, z), 0.05, m)
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), skin)
    head.position.set(x, base + 1.75 - 0.115, z); head.castShadow = true
    g.add(head)
  }
  standing(-6, -1.2, STAGE.deckH, cloth)
  standing(7.5, -2.2, STAGE.deckH, cloth)
  standing(1.6, 2.4, STAGE.foreH, cloth2)
  standing(-3, 9, 0, cloth2)
  return g
}
