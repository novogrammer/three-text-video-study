import {
  BackSide, CanvasTexture, Color, FogExp2, Group, Mesh, MeshBasicMaterial,
  PerspectiveCamera, RepeatWrapping, Scene, SRGBColorSpace, TorusGeometry,
} from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'
import type { StudyScene } from './StudyScene'
import { TextCanvas } from '../text/canvas'
import { getLoopProgress } from '../animation/timeline'

/** 固定カメラを管の中心に保ち、トーラス側を公転・自転させる。 */
export class TorusScene implements StudyScene {
  readonly duration = 12
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(80, 1, 0.03, 50)
  private readonly orbit = new Group()
  private readonly ring = new Group()
  private readonly geometry = new TorusGeometry(4.5, 1.35, 64, 256)
  private readonly material = new MeshBasicMaterial({ side: BackSide })
  private readonly torus = new Mesh(this.geometry, this.material)
  private readonly textCanvas = new TextCanvas()
  private textTexture: CanvasTexture | null = null
  private textRevision = 0
  private disposed = false

  constructor() {
    this.scene.background = new Color(0x121c29)
    this.scene.fog = new FogExp2(0x121c29, 0.16)
    this.camera.lookAt(0, 0, -1)
    this.ring.position.x = -4.5
    this.ring.rotation.x = Math.PI / 2
    this.ring.add(this.torus)
    this.orbit.add(this.ring)
    this.scene.add(this.orbit)
    this.update(0)
  }

  update(time: number): void {
    const angle = getLoopProgress(time, this.duration) * Math.PI * 2
    // 視線軸の周りを公転。接線は常に-Zなのでカメラは動かさない。
    this.orbit.rotation.z = angle
    // トーラス自身の軸で自転し、内壁の文字を流す。
    this.torus.rotation.z = angle
  }

  async setText(text: string): Promise<void> {
    if (this.disposed) throw new Error('破棄されたシーンにはテキストを反映できません。')
    const revision = ++this.textRevision
    const canvas = await this.textCanvas.draw(text, {
      width: 768, height: 512,
      fontFamily: 'Noto Sans JP', fontWeight: 700,
      fontSize: 48, minFontSize: 16, lineHeight: 1.6, letterSpacing: 1,
      textAlign: 'left', color: '#ffe1af', background: '#304c68', padding: 40,
      pixelRatio: Math.min(Math.max(window.devicePixelRatio, 1), 2),
    })
    if (this.disposed || revision !== this.textRevision) return
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(8, 3)
    // 内壁から見るためUを反転し、文字が鏡像になるのを防ぐ。
    texture.repeat.x = -8
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
    this.scene.clear()
  }
}
