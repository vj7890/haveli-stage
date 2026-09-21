import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

export type Stage = ReturnType<typeof createScene>

/**
 * Renderer, camera, orbit controls and a post chain (render → bloom → output)
 * on one animation loop. Bloom is what makes the LED read as light rather
 * than a painted surface; its strength is a slider, and 0 is a plain render.
 */
export function createScene(el: HTMLElement, bg = 0x0f0e0c) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  renderer.localClippingEnabled = true
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(bg)

  const camera = new THREE.PerspectiveCamera(42, el.clientWidth / el.clientHeight, 0.1, 600)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.maxPolarAngle = Math.PI / 2 - 0.01
  controls.minDistance = 1
  controls.maxDistance = 140

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), 0.25, 0.45, 0.92)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const root = new THREE.Group()
  scene.add(root)

  const resize = () => {
    if (!el.clientWidth || !el.clientHeight) return
    camera.aspect = el.clientWidth / el.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(el.clientWidth, el.clientHeight)
    composer.setSize(el.clientWidth, el.clientHeight)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(el)

  let onFrame: ((dt: number, t: number) => void) | null = null
  let last = performance.now()
  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const dt = Math.min(0.08, (now - last) / 1000)
    last = now
    onFrame?.(dt, now / 1000)
    controls.update()
    composer.render()
  })

  return {
    renderer, scene, camera, controls, root, bloom, composer,
    setFrame(fn: ((dt: number, t: number) => void) | null) { onFrame = fn },
    /** Camera distance that fits a w × h rectangle in view. */
    fitDistance(w: number, h: number, margin = 1.1) {
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      return Math.max(h / 2 / t, w / 2 / t / camera.aspect) * margin
    },
    /** One frame at a given size, returned as a PNG data URL, then back. */
    still(w = 3840, h = 2160) {
      const cw = el.clientWidth, ch = el.clientHeight
      const pr = renderer.getPixelRatio()
      renderer.setPixelRatio(1)
      renderer.setSize(w, h, false)
      composer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      composer.render()
      const url = renderer.domElement.toDataURL('image/png')
      renderer.setPixelRatio(pr)
      renderer.setSize(cw, ch)
      composer.setSize(cw, ch)
      camera.aspect = cw / ch
      camera.updateProjectionMatrix()
      return url
    },
    dispose() {
      ro.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose?.()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose?.()
      })
      composer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement)
    },
  }
}

/** House light: a soft hemisphere and a little fill, so the set reads with the rig off. */
export function houseLights(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x2a2622, 1.0)
  const amb = new THREE.AmbientLight(0xffffff, 0.35)
  const key = new THREE.DirectionalLight(0xfff4e6, 0.9)
  key.position.set(18, 30, 40)
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.3)
  fill.position.set(-30, 12, -10)
  scene.add(hemi, amb, key, fill)
  return [hemi, amb, key, fill] as THREE.Light[]
}
