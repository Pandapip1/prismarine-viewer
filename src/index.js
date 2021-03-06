/* global THREE */
global.THREE = require('three')
require('three/examples/js/controls/OrbitControls')
const { WorldRenderer } = require('./worldrenderer')
const { Entities } = require('./entities')
const { Primitives } = require('./primitives')
const Vec3 = require('vec3').Vec3

const io = require('socket.io-client')
const socket = io()

const scene = new THREE.Scene()
scene.background = new THREE.Color('lightblue')

const ambientLight = new THREE.AmbientLight(0xcccccc)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
directionalLight.position.set(1, 1, 0.5).normalize()
scene.add(directionalLight)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.z = 5
let firstPositionUpdate = true

const world = new WorldRenderer(scene)
const entities = new Entities(scene)
const primitives = new Primitives(scene)

const renderer = new THREE.WebGLRenderer()
renderer.setPixelRatio(window.devicePixelRatio || 1)
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

let controls = new THREE.OrbitControls(camera, renderer.domElement)

var pitchyaw = {
  pitch:0,
  yaw:0
}

function animate () {
  window.requestAnimationFrame(animate)
  if (controls) controls.update()
  renderer.render(scene, camera)
}
animate()

socket.on('version', (version) => {
  console.log('Using version: ' + version)
  world.setVersion(version)
  entities.clear()
  primitives.clear()
  firstPositionUpdate = true

  let botMesh
  socket.on('position', ({ pos, addMesh, yaw, pitch }) => {
    if (yaw !== undefined && pitch !== undefined) {
      if (controls) {
        controls.dispose()
        controls = null
      }
      camera.position.set(pos.x, pos.y + 1.6, pos.z)
      pitch = pitchyaw.pitch*.9 + pitch * .1;
      yaw = pitchyaw.yaw * .9 + yaw * .1;
      pitchyaw.pitch = pitch;
      pitchyaw.yaw = yaw;
      camera.lookAt(pos.x-Math.cos(pitch)*Math.sin(yaw), pos.y-Math.sin(pitch)+1.6, pos.z-Math.cos(pitch)*Math.cos(yaw))
      return
    }
    if (pos.y > 0 && firstPositionUpdate) {
      controls.target.set(pos.x, pos.y, pos.z)
      camera.position.set(pos.x, pos.y + 20, pos.z + 20)
      controls.update()
      firstPositionUpdate = false
    }
    if (addMesh) {
      if (!botMesh) {
        const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6)
        geometry.translate(0, 0.9, 0)
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        botMesh = new THREE.Mesh(geometry, material)
        scene.add(botMesh)
      }
      botMesh.position.set(pos.x, pos.y, pos.z)
    }
  })

  socket.on('entity', (e) => {
    entities.update(e)
  })

  socket.on('primitive', (p) => {
    primitives.update(p)
  })

  socket.on('chunk', (data) => {
    const [x, z] = data.coords.split(',')
    world.addColumn(parseInt(x, 10), parseInt(z, 10), data.chunk)
  })

  socket.on('unloadChunk', ({ x, z }) => {
    world.removeColumn(x, z)
  })

  socket.on('blockUpdate', ({ pos, stateId }) => {
    world.setBlockStateId(new Vec3(pos.x, pos.y, pos.z), stateId)
  })
})
