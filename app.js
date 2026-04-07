let initialized = false

window.ecs.ready().then(() => {
  window.ecs.registerBehavior((world) => {
    if (initialized) return
    initialized = true

    const THREE = window.THREE

    // --- 비디오 ---
    const video = document.createElement('video')
    video.src = 'assets/output-example-alpha.webm'
    video.autoplay = true
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    document.body.appendChild(video)
    video.play()

    // --- 크로마키 셰이더 (초록색 제거) ---
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `
    const fragmentShader = `
      uniform sampler2D map;
      uniform vec3 keyColor;
      uniform float similarity;
      uniform float smoothness;
      varying vec2 vUv;

      void main() {
        vec4 col = texture2D(map, vUv);
        // YCbCr 색공간에서 크로마 거리 계산
        float Cb1 = -0.169 * keyColor.r - 0.331 * keyColor.g + 0.500 * keyColor.b;
        float Cr1 =  0.500 * keyColor.r - 0.419 * keyColor.g - 0.081 * keyColor.b;
        float Cb2 = -0.169 * col.r      - 0.331 * col.g      + 0.500 * col.b;
        float Cr2 =  0.500 * col.r      - 0.419 * col.g      - 0.081 * col.b;
        float d = distance(vec2(Cb1, Cr1), vec2(Cb2, Cr2));
        float alpha = smoothstep(similarity, similarity + smoothness, d);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col.rgb, alpha);
      }
    `

    const texture = new THREE.VideoTexture(video)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    const material = new THREE.ShaderMaterial({
      uniforms: {
        map:        { value: texture },
        keyColor:   { value: new THREE.Color(0.0, 1.0, 0.0) }, // 초록색 기본값
        similarity: { value: 0.3 },
        smoothness: { value: 0.1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
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
