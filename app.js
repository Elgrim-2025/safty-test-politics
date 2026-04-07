let initialized = false

window.ecs.ready().then(() => {
  window.ecs.registerBehavior((world) => {
    if (initialized) return
    initialized = true

    const THREE = window.THREE

    // --- 비디오 (소리 포함, 첫 터치 시 재생) ---
    const video = document.createElement('video')
    video.src = 'assets/output-example-alpha.webm'
    video.loop = true
    video.muted = true   // 자동재생 정책 때문에 처음엔 muted로 시작
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    document.body.appendChild(video)
    video.play()

    // 첫 터치 때 소리 활성화 (브라우저 자동재생 정책)
    const enableAudio = () => {
      video.muted = false
      document.removeEventListener('touchstart', enableAudio)
    }
    document.addEventListener('touchstart', enableAudio, { once: true })

    // --- 알파채널 WebM: 영상 자체 알파 사용 (크로마키 불필요) ---
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
      uniforms: {
        map: { value: texture },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      premultipliedAlpha: false,
    })

    const geometry = new THREE.PlaneGeometry(1.5, 1.5)
    const mesh = new THREE.Mesh(geometry, material)

    // 바닥 기준 위치 (y=0.75 = 패널 중심, z=-2 = 카메라 앞 2m)
    mesh.position.set(0, 0.75, -2)
    world.three.scene.add(mesh)

    // --- 드래그 & 핀치 ---
    const camera = world.three.activeCamera
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) // y=0 평면
    const raycaster = new THREE.Raycaster()
    const ndcToWorld = (x, y) => {
      const ndc = new THREE.Vector2(
        (x / window.innerWidth) * 2 - 1,
        -(y / window.innerHeight) * 2 + 1
      )
      raycaster.setFromCamera(ndc, camera)
      const target = new THREE.Vector3()
      raycaster.ray.intersectPlane(floorPlane, target)
      return target
    }

    let dragActive = false
    let dragOffsetX = 0
    let dragOffsetZ = 0
    let lastPinchDist = null

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const hit = ndcToWorld(e.touches[0].clientX, e.touches[0].clientY)
        if (hit) {
          dragActive = true
          dragOffsetX = mesh.position.x - hit.x
          dragOffsetZ = mesh.position.z - hit.z
        }
      }
      if (e.touches.length === 2) {
        dragActive = false
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinchDist = Math.hypot(dx, dy)
      }
    }, { passive: true })

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && dragActive) {
        const hit = ndcToWorld(e.touches[0].clientX, e.touches[0].clientY)
        if (hit) {
          mesh.position.x = hit.x + dragOffsetX
          mesh.position.z = hit.z + dragOffsetZ
        }
      }
      if (e.touches.length === 2 && lastPinchDist !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const ratio = dist / lastPinchDist
        mesh.scale.multiplyScalar(ratio)
        lastPinchDist = dist
      }
    }, { passive: true })

    document.addEventListener('touchend', () => {
      dragActive = false
      lastPinchDist = null
    }, { passive: true })
  })
})
