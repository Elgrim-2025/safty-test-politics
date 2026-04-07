let initialized = false
let mesh = null
let placed = false
let fixedPos = null

const smoothPos = { x: 0, y: 0, z: 0 }
const smoothQuat = { x: 0, y: 0, z: 0, w: 1 }
let camReady = false
const SMOOTH = 0.05

window.ecs.ready().then(() => {
  window.ecs.registerBehavior((world) => {
    const THREE = window.THREE
    const camera = world.three.activeCamera

    // 카메라 스무딩 (매 프레임)
    const rawPos = new THREE.Vector3()
    const rawQuat = new THREE.Quaternion()
    camera.getWorldPosition(rawPos)
    camera.getWorldQuaternion(rawQuat)

    if (!camReady) {
      smoothPos.x = rawPos.x; smoothPos.y = rawPos.y; smoothPos.z = rawPos.z
      smoothQuat.x = rawQuat.x; smoothQuat.y = rawQuat.y
      smoothQuat.z = rawQuat.z; smoothQuat.w = rawQuat.w
      camReady = true
    } else {
      smoothPos.x += (rawPos.x - smoothPos.x) * SMOOTH
      smoothPos.y += (rawPos.y - smoothPos.y) * SMOOTH
      smoothPos.z += (rawPos.z - smoothPos.z) * SMOOTH
      const dot = smoothQuat.x*rawQuat.x + smoothQuat.y*rawQuat.y + smoothQuat.z*rawQuat.z + smoothQuat.w*rawQuat.w
      const sx = dot < 0 ? -rawQuat.x : rawQuat.x
      const sy = dot < 0 ? -rawQuat.y : rawQuat.y
      const sz = dot < 0 ? -rawQuat.z : rawQuat.z
      const sw = dot < 0 ? -rawQuat.w : rawQuat.w
      smoothQuat.x += (sx - smoothQuat.x) * SMOOTH
      smoothQuat.y += (sy - smoothQuat.y) * SMOOTH
      smoothQuat.z += (sz - smoothQuat.z) * SMOOTH
      smoothQuat.w += (sw - smoothQuat.w) * SMOOTH
      const len = Math.hypot(smoothQuat.x, smoothQuat.y, smoothQuat.z, smoothQuat.w)
      smoothQuat.x /= len; smoothQuat.y /= len; smoothQuat.z /= len; smoothQuat.w /= len
      camera.position.set(smoothPos.x, smoothPos.y, smoothPos.z)
      camera.quaternion.set(smoothQuat.x, smoothQuat.y, smoothQuat.z, smoothQuat.w)
    }

    if (!initialized) {
      initialized = true

      const video = document.createElement('video')
      video.src = 'assets/output-example-alpha.webm'
      video.loop = true
      video.muted = true
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      document.body.appendChild(video)
      video.play()

      document.addEventListener('touchstart', () => { video.muted = false }, { once: true })

      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `
      const fragmentShader = `
        uniform sampler2D map;
        varying vec2 vUv;
        void main() {
          vec4 col = texture2D(map, vUv);
          if (col.a < 0.05) discard;
          gl_FragColor = col;
        }
      `
      const texture = new THREE.VideoTexture(video)
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.format = THREE.RGBAFormat

      const material = new THREE.ShaderMaterial({
        uniforms: { map: { value: texture } },
        vertexShader,
        fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        premultipliedAlpha: false,
      })

      mesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), material)
      mesh.visible = false
      world.three.scene.add(mesh)

      const hint = document.getElementById('ui-hint')
      let lastPinchDist = null

      const placeInFront = () => {
        const camera = world.three.activeCamera
        const camPos = new THREE.Vector3()
        const camDir = new THREE.Vector3()
        camera.getWorldPosition(camPos)
        camera.getWorldDirection(camDir)
        camDir.y = 0
        camDir.normalize()
        fixedPos = new THREE.Vector3(
          camPos.x + camDir.x * 15,
          1.5,
          camPos.z + camDir.z * 15
        )
        mesh.position.copy(fixedPos)
      }

      document.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX
          const dy = e.touches[0].clientY - e.touches[1].clientY
          lastPinchDist = Math.hypot(dx, dy)
        }
      }, { passive: true })

      document.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && lastPinchDist !== null) {
          const dx = e.touches[0].clientX - e.touches[1].clientX
          const dy = e.touches[0].clientY - e.touches[1].clientY
          const dist = Math.hypot(dx, dy)
          mesh.scale.multiplyScalar(dist / lastPinchDist)
          lastPinchDist = dist
        }
      }, { passive: true })

      document.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) lastPinchDist = null
        if (e.touches.length === 0 && e.changedTouches.length === 1) {
          if (!placed) {
            placed = true
            mesh.visible = true
            hint.classList.add('hidden')
          }
          placeInFront()
        }
      }, { passive: true })
    }

    if (mesh && mesh.visible && fixedPos) {
      mesh.position.copy(fixedPos)
    }
  })
})
