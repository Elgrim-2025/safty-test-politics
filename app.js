let initialized = false
let mesh = null
let placed = false
let fixedPos = null

window.ecs.ready().then(() => {
  window.ecs.registerBehavior((world) => {
    const THREE = window.THREE

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
