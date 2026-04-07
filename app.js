let created = false

window.ecs.ready().then(() => {
  window.ecs.registerBehavior((world) => {
    if (created) return
    created = true

    const eid = world.createEntity()

    // 평면 지오메트리 (정사각형)
    window.ecs.PlaneGeometry.set(world, eid, {
      width: 1.5,
      height: 1.5,
    })

    // 동영상 머테리얼
    window.ecs.VideoMaterial.set(world, eid, {
      textureSrc: 'assets/output-example-alpha.webm',
    })

    // 위치: 바닥(y=0) 기준으로 카메라 앞 2m, 높이 0.75m (패널 중심)
    world.setPosition(eid, 0, 0.75, -2)

    // 수직으로 세우기 (회전 없음 = 카메라를 향해 수직)
    world.setQuaternion(eid, 0, 0, 0, 1)
  })
})
