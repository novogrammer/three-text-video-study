import {
  AdditiveBlending, CanvasTexture, Color, ConeGeometry, FogExp2, GridHelper,
  Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Scene,
  SRGBColorSpace,
} from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'
import type { StudyScene } from './StudyScene'
import { TextCanvas } from '../text/canvas'
import { getLoopProgress } from '../animation/timeline'

export class VaporwaveScene implements StudyScene {
  readonly duration = 12
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(65, 1, 0.1, 180)
  private readonly tiles: Group[] = []
  private readonly grids: GridHelper[] = []
  private readonly textPlanes: Mesh<PlaneGeometry, MeshBasicMaterial>[] = []
  private readonly textGeometry = new PlaneGeometry(9, 4.5)
  private readonly mountainGeometry = new ConeGeometry(1, 1, 4, 1, true)
  private readonly mountainMaterial = new MeshBasicMaterial({
    color: 0xab42da, wireframe: true,
  })
  private readonly sunGeometry = new PlaneGeometry(25, 25)
  private readonly sunTexture: CanvasTexture
  private readonly sunMaterial: MeshBasicMaterial
  private readonly textCanvas = new TextCanvas()
  private textTexture: CanvasTexture | null = null
  private textRevision = 0
  private disposed = false

  constructor() {
    this.scene.background = new Color(0x100c25)
    this.scene.fog = new FogExp2(0x100c25, 0.035)
    this.camera.position.set(0, 2.4, 8)
    this.camera.lookAt(0, 3.2, -50)

    this.sunTexture = this.createSunTexture()
    this.sunMaterial = new MeshBasicMaterial({
      map: this.sunTexture, transparent: true, depthWrite: false, fog: false,
    })
    const sun = new Mesh(this.sunGeometry, this.sunMaterial)
    sun.position.set(0, 9, -85)
    this.scene.add(sun)

    // 同じ区間を並べ、カメラの後方まで通過してから奥へ戻す。
    for (let index = 0; index < 4; index++) {
      const tile = new Group()
      const grid = new GridHelper(32, 32, 0xff65d4, 0x7938b8)
      tile.add(grid)
      this.grids.push(grid)
      for (const side of [-1, 1]) {
        const mountain = new Mesh(this.mountainGeometry, this.mountainMaterial)
        mountain.scale.set(7, 9, 10)
        mountain.position.set(side * 21, 4.5, -4)
        mountain.rotation.y = Math.PI / 4
        tile.add(mountain)

        const material = new MeshBasicMaterial({
          color: side < 0 ? 0x7ceeff : 0xff86da,
          transparent: true, depthWrite: false, blending: AdditiveBlending,
        })
        const plane = new Mesh(this.textGeometry, material)
        plane.position.set(side * 8, 3.5, -8 + (side > 0 ? -16 : 0))
        plane.rotation.y = -side * 0.2
        tile.add(plane)
        this.textPlanes.push(plane)
      }
      this.tiles.push(tile)
      this.scene.add(tile)
    }
    this.update(0)
  }

  private createSunTexture(): CanvasTexture {
    // シーンの素材用Canvas。UIのDOMには追加しない。
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const context = canvas.getContext('2d')
    if (!context) throw new Error('夕日用のCanvasを作成できません。')
    const gradient = context.createLinearGradient(0, 0, 0, 512)
    gradient.addColorStop(0, '#ffdb7b')
    gradient.addColorStop(0.5, '#ff768c')
    gradient.addColorStop(1, '#e642bc')
    context.beginPath()
    context.arc(256, 256, 250, 0, Math.PI * 2)
    context.clip()
    context.fillStyle = gradient
    context.fillRect(0, 0, 512, 512)
    for (let y = 280; y < 512; y += 34) {
      context.clearRect(0, y, 512, 7 + (y - 280) * 0.045)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
  }

  update(time: number): void {
    const travel = getLoopProgress(time, this.duration) * 32
    this.tiles.forEach((tile, index) => {
      tile.position.z = 48 - ((32 + index * 32 - travel + 128) % 128)
    })
    for (const plane of this.textPlanes) {
      const z = plane.position.z + plane.parent!.position.z
      // 手前の文字を消してから区間を再配置し、切り替わりを見せない。
      const fade = Math.max(0, Math.min(1, (4 - z) / 12))
      plane.material.opacity = fade * fade * (3 - 2 * fade)
    }
  }

  async setText(text: string): Promise<void> {
    if (this.disposed) throw new Error('破棄されたシーンにはテキストを反映できません。')
    const revision = ++this.textRevision
    const source = await this.textCanvas.draw(text, {
      width: 1024, height: 512,
      fontFamily: 'Noto Sans JP', fontWeight: 300,
      fontSize: 64, minFontSize: 18, lineHeight: 1.6, letterSpacing: 2,
      textAlign: 'center', color: '#ffffff', background: 'transparent', padding: 48,
      pixelRatio: Math.min(Math.max(window.devicePixelRatio, 1), 2),
    })
    if (this.disposed || revision !== this.textRevision) return
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('ネオン文字用のCanvasを作成できません。')
    context.shadowColor = '#ffffff'
    context.shadowBlur = 6 * source.width / 1024
    context.drawImage(source, 0, 0)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    for (const plane of this.textPlanes) {
      plane.material.map = texture
      plane.material.needsUpdate = true
    }
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
    for (const plane of this.textPlanes) {
      plane.material.map = null
      plane.material.dispose()
    }
    this.textTexture?.dispose()
    this.textTexture = null
    for (const grid of this.grids) grid.dispose()
    this.textGeometry.dispose()
    this.mountainGeometry.dispose()
    this.mountainMaterial.dispose()
    this.sunGeometry.dispose()
    this.sunTexture.dispose()
    this.sunMaterial.dispose()
    this.scene.clear()
  }
}
