import {
  BoxGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
} from 'three/webgpu'
import type { StudyScene } from './StudyScene'
import { getLoopProgress } from '../animation/timeline'

export class CubeScene implements StudyScene {
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(45, 1, 0.1, 100)

  readonly duration = 8
  private readonly geometry = new BoxGeometry(1.4, 1.4, 1.4)
  private readonly material = new MeshStandardMaterial({
    color: 0x68cf91,
    roughness: 0.45,
    metalness: 0.05,
  })
  private readonly cube = new Mesh(this.geometry, this.material)
  private readonly grid = new GridHelper(12, 24, 0x465366, 0x263342)

  constructor() {
    this.scene.background = new Color(0x141b25)
    this.camera.position.set(4, 3, 6)
    this.camera.lookAt(0, 0.1, 0)

    const ambientLight = new HemisphereLight(0xdceeff, 0x4b535f, 2)
    const keyLight = new DirectionalLight(0xffffff, 3)
    keyLight.position.set(3, 5, 4)

    this.grid.position.y = -1.4
    this.scene.add(this.cube, this.grid, ambientLight, keyLight)
    this.update(0)
  }

  /** 秒単位の絶対時刻から決める。前フレームの状態には依存しない。 */
  update(time: number): void {
    const angle = getLoopProgress(time, this.duration) * Math.PI * 2
    this.cube.position.y = Math.sin(angle) * 0.25
    this.cube.rotation.set(0.2 + Math.sin(angle) * 0.15, angle, 0.1)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.zoom = Math.min(1, this.camera.aspect / 0.8)
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.grid.dispose()
    this.scene.clear()
  }
}
