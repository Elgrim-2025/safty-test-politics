let initialized = false
let mesh = null
let placed = false
let fixedPos = null  // 고정된 world 좌표

// 카메라 스무딩용
const smoothPos = { x: 0, y: 0, z: 0 }
const smoothQuat = { x: 0, y: 0, z: 0, w: 1 }
let camReady = false
const SMOOTH = 0.15  // 낮을수록 더 부드러움 (0.05~0.2)

window.ecs.ready().then(() => {
  window.ecs.registerBehavior((world) => {
    const THREE = window.THREE
    const camera = world.three.activeCamera

    // --- 카메라 포즈 스무딩 (매 프레임) ---
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
      // slerp quaternion
      const dot = smoothQuat.x * rawQuat.x + smoothQuat.y * rawQuat.y +
                  smoothQuat.z * rawQuat.z + smoothQuat.w * rawQuat.w
      const qx = dot < 0 ? -rawQuat.x : rawQuat.x
      const qy = dot < 0 ? -rawQuat.y : rawQuat.y
      const qz = dot < 0 ? -rawQuat.z : rawQuat.z
      const qw = dot < 0 ? -rawQuat.w : rawQuat.w
      smoothQuat.x += (qx - smoothQuat.x) * SMOOTH
      smoothQuat.y += (qy - smoothQuat.y) * SMOOTH
      smoothQuat.z += (qz - smoothQuat.z) * SMOOTH
      smoothQuat.w += (qw - smoothQuat.w) * SMOOTH
      // normalize
      const len = Math.hypot(smoothQuat.x, smoothQuat.y, smoothQuat.z, smoothQuat.w)
      smoothQuat.x /= len; smoothQuat.y /= len
      smoothQuat.z /= len; smoothQuat.w /= len

      camera.position.set(smoothPos.x, smoothPos.y, smoothPos.z)
      camera.quaternion.set(smoothQuat.x, smoothQuat.y, smoothQuat.z, smoothQuat.w)
    }

    // --- 초기화 (최초 1회) ---
    if (!initialized) {
      initialized = true

      // iOS에서 흰 배경 방지
      const renderer = world.three.renderer
      renderer.setClearColor(0x000000, 0)
      renderer.setPixelRatio(window.devicePixelRatio)

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
        const camPos = new THREE.Vector3(smoothPos.x, smoothPos.y, smoothPos.z)
        const camDir = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(new THREE.Quaternion(smoothQuat.x, smoothQuat.y, smoothQuat.z, smoothQuat.w))
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

    // mesh는 fixedPos에 고정 (매 프레임 덮어써서 SLAM drift 방지)
    if (mesh && mesh.visible && fixedPos) {
      mesh.position.copy(fixedPos)
    }
  })
})
