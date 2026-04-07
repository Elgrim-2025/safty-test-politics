let initialized = false
let mesh = null
let placed = false
let fixedPos = null
let targetPos = null  // 이동 목표 (스무딩용)

window.ecs.ready().then(() => {
  window.ecs.registerBehavior((world) => {
    const THREE = window.THREE

    if (!initialized) {
      initialized = true

      // 카메라 준비되면 로딩 커버 제거
      const cover = document.getElementById('loading-cover')
      if (cover) cover.classList.add('hidden')
      setTimeout(() => { if (cover) cover.remove() }, 600)

      const video = document.createElement('video')
      video.src = 'assets/example-final.mp4'
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
        uniform vec3 keyColor;
        uniform float similarity;
        uniform float smoothness;
        varying vec2 vUv;
        void main() {
          vec4 col = texture2D(map, vUv);
          float Cb1 = -0.169 * keyColor.r - 0.331 * keyColor.g + 0.500 * keyColor.b;
          float Cr1 =  0.500 * keyColor.r - 0.419 * keyColor.g - 0.081 * keyColor.b;
          float Cb2 = -0.169 * col.r      - 0.331 * col.g      + 0.500 * col.b;
          float Cr2 =  0.500 * col.r      - 0.419 * col.g      - 0.081 * col.b;
          float d = distance(vec2(Cb1, Cr1), vec2(Cb2, Cr2));
          float alpha = smoothstep(similarity, similarity + smoothness, d);
          gl_FragColor = vec4(col.rgb, alpha);
        }
      `
      const texture = new THREE.VideoTexture(video)
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter

      const material = new THREE.ShaderMaterial({
        uniforms: {
          map:        { value: texture },
          keyColor:   { value: new THREE.Color(0.0, 1.0, 0.0) },
          similarity: { value: 0.4 },
          smoothness: { value: 0.1 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendEquation: THREE.AddEquation,
      })

      mesh = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), material)
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
        targetPos = new THREE.Vector3(
          camPos.x + camDir.x * 15,
          1.5,
          camPos.z + camDir.z * 15
        )
        if (!fixedPos) fixedPos = targetPos.clone()
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

    if (mesh && mesh.visible && fixedPos && targetPos) {
      // 이동 스무딩
      fixedPos.lerp(targetPos, 0.08)
      mesh.position.copy(fixedPos)

      // 빌보드: 항상 카메라를 향하되 y축만 회전
      const camera = world.three.activeCamera
      const camPos = new THREE.Vector3()
      camera.getWorldPosition(camPos)
      camPos.y = mesh.position.y
      mesh.lookAt(camPos)
    }
  })
})
