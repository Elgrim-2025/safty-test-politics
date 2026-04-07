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

    // --- 터치: 카메라 앞 고정 거리에 재소환 + 핀치 크기 조절 ---
    const camera = world.three.activeCamera
    let lastPinchDist = null

    const placeInFront = () => {
      const camPos = new THREE.Vector3()
      const camDir = new THREE.Vector3()
      camera.getWorldPosition(camPos)
      camera.getWorldDirection(camDir)
      camDir.y = 0
      camDir.normalize()
      mesh.position.set(
        camPos.x + camDir.x * 2,
        0.75,
        camPos.z + camDir.z * 2
      )
    }

    placeInFront() // 시작 시 바로 배치

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
        placeInFront()
      }
    }, { passive: true })
  })
})
