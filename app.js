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

    // --- 터치한 바닥 위치로 재소환 ---
    const camera = world.three.activeCamera
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const raycaster = new THREE.Raycaster()

    document.addEventListener('touchend', (e) => {
      if (e.changedTouches.length !== 1) return
      const touch = e.changedTouches[0]
      const ndc = new THREE.Vector2(
        (touch.clientX / window.innerWidth) * 2 - 1,
        -(touch.clientY / window.innerHeight) * 2 + 1
      )
      raycaster.setFromCamera(ndc, camera)
      const hit = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(floorPlane, hit)) {
        mesh.position.set(hit.x, 0.75, hit.z)
      }
    }, { passive: true })
  })
})
