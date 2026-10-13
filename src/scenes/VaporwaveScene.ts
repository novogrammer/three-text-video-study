import {
  AdditiveBlending, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute,
  FogExp2, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
  PerspectiveCamera, PlaneGeometry, RenderPipeline, Scene, SRGBColorSpace,
} from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import type { WebGPURenderer } from 'three/webgpu'
import type { StudyScene } from './StudyScene'
import { TextCanvas } from '../text/canvas'
import { getLoopProgress } from '../animation/timeline'

export class VaporwaveScene implements StudyScene {
  readonly duration = 12
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(65, 1, 0.1, 180)
  private readonly scenePass = pass(this.scene, this.camera, { samples: 4 })
  private readonly sceneColor = this.scenePass.getTextureNode('output')
  private readonly bloomPass = bloom(this.sceneColor, 0.65, 0.2, 1)
  private pipeline: RenderPipeline | null = null
  private readonly tiles: Group[] = []
  private readonly terrainGeometry = this.createTerrainGeometry()
  private readonly terrainMaterial = new LineBasicMaterial({ vertexColors: true })
  private readonly textPlanes: Mesh<PlaneGeometry, MeshBasicMaterial>[] = []
  private readonly textGeometry = new PlaneGeometry(9, 4.5)
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
      tile.add(new LineSegments(this.terrainGeometry, this.terrainMaterial))
      for (const side of [-1, 1]) {
        const material = new MeshBasicMaterial({
          // HDRの明るさでBloomを発生させ、細い文字本体はそのまま残す。
          color: new Color(side < 0 ? 0x7ceeff : 0xff86da).multiplyScalar(4),
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

  private terrainHeight(x: number, z: number): number {
    // 中央12単位を平らにし、道の端から山へ滑らかにつなぐ。
    const edge = Math.max(0, Math.min(1, (Math.abs(x) - 6) / 8))
    const slope = edge * edge * (3 - 2 * edge)
    const phase = z / 32 * Math.PI * 2
    const side = Math.sign(x)
    // Z方向を32単位周期にして、区間の境界でも高さを一致させる。
    const ridge = 5
      + 2.3 * Math.sin(phase + x * 0.21 + side * 0.7)
      + 1.5 * Math.sin(phase * 2 - x * 0.37)
      + 0.8 * Math.cos(phase * 3 + x * 0.51)
    return slope * ridge
  }

  private createTerrainGeometry(): BufferGeometry {
    const positions: number[] = []
    const colors: number[] = []
    const regular = new Color(0x9b47c9)
    const roadEdge = new Color(0xff65d4).multiplyScalar(3)
    const addSegment = (x1: number, z1: number, x2: number, z2: number): void => {
      const color = x1 === x2 && Math.abs(x1) === 6 ? roadEdge : regular
      positions.push(x1, this.terrainHeight(x1, z1), z1,
        x2, this.terrainHeight(x2, z2), z2)
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b)
    }
    // 三角形の対角線は作らず、縦横の格子を1単位ごとに持ち上げる。
    for (let x = -32; x <= 32; x++) {
      for (let z = -16; z < 16; z++) addSegment(x, z, x, z + 1)
    }
    // 最後の横線は次の区間と共有するので、二重描画しない。
    for (let z = -16; z < 16; z++) {
      for (let x = -32; x < 32; x++) addSegment(x, z, x + 1, z)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    geometry.computeBoundingSphere()
    return geometry
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
      fontFamily: 'Noto Sans JP', fontWeight: 100,
      fontSize: 64, minFontSize: 18, lineHeight: 1.6, letterSpacing: 2,
      textAlign: 'center', color: '#ffffff', background: 'transparent', padding: 48,
      pixelRatio: Math.min(Math.max(window.devicePixelRatio, 1), 2),
    })
    if (this.disposed || revision !== this.textRevision) return
    const texture = new CanvasTexture(source)
    texture.colorSpace = SRGBColorSpace
    for (const plane of this.textPlanes) {
      plane.material.map = texture
      plane.material.needsUpdate = true
    }
    this.textTexture?.dispose()
    this.textTexture = texture
  }

  render(renderer: WebGPURenderer): void {
    this.pipeline ??= new RenderPipeline(renderer, this.sceneColor.add(this.bloomPass))
    // 中間パスは線形HDRで処理し、最終パスを共通の出力先へ描画する。
    const target = renderer.getRenderTarget()
    const toneMapping = renderer.toneMapping
    const outputColorSpace = renderer.outputColorSpace
    const xrEnabled = renderer.xr.enabled
    try {
      this.pipeline.render()
    } finally {
      renderer.setRenderTarget(target)
      renderer.toneMapping = toneMapping
      renderer.outputColorSpace = outputColorSpace
      renderer.xr.enabled = xrEnabled
    }
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
    this.pipeline?.dispose()
    this.bloomPass.dispose()
    this.scenePass.dispose()
    this.terrainGeometry.dispose()
    this.terrainMaterial.dispose()
    this.textGeometry.dispose()
    this.sunGeometry.dispose()
    this.sunTexture.dispose()
    this.sunMaterial.dispose()
    this.scene.clear()
  }
}
