import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
} from 'three/webgpu'
import type { StudyScene } from './StudyScene'
import type { WebGPURenderer } from 'three/webgpu'
import { TextCanvas } from '../text/canvas'
import { getLoopProgress } from '../animation/timeline'

export class CubeScene implements StudyScene {
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(45, 1, 0.1, 100)

  readonly duration = 8
  private readonly textCanvas = new TextCanvas()
  private textTexture: CanvasTexture | null = null
  private textRevision = 0
  private disposed = false
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

  async setText(text: string): Promise<void> {
    if (this.disposed) throw new Error('破棄されたシーンにはテキストを反映できません。')
    const revision = ++this.textRevision
    const canvas = await this.textCanvas.draw(text, {
      width: 512,
      height: 512,
      fontFamily: 'Noto Sans JP',
      fontWeight: 700,
      fontSize: 40,
      minFontSize: 16,
      lineHeight: 1.6,
      letterSpacing: 1,
      textAlign: 'left',
      color: '#17211d',
      background: '#ffffff',
      padding: 44,
      pixelRatio: Math.min(Math.max(window.devicePixelRatio, 1), 2),
    })
    // 読み込み中の破棄や新しい入力を、古い結果で上書きしない。
    if (this.disposed || revision !== this.textRevision) return
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    this.material.map = texture
    this.material.needsUpdate = true
    this.textTexture?.dispose()
    this.textTexture = texture
  }

  render(renderer: WebGPURenderer): void {
    renderer.render(this.scene, this.camera)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.zoom = Math.min(1, this.camera.aspect / 0.8)
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.textRevision++
    this.material.map = null
    this.textTexture?.dispose()
    this.textTexture = null
    this.geometry.dispose()
    this.material.dispose()
    this.grid.dispose()
    this.scene.clear()
  }
}
