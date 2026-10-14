import {
  BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, DirectionalLight,
  Float32BufferAttribute, FrontSide, HemisphereLight, Mesh, MeshStandardNodeMaterial,
  PerspectiveCamera, Quaternion, RepeatWrapping, Scene, SRGBColorSpace, Vector3,
} from 'three/webgpu'
import { materialColor } from 'three/tsl'
import type { WebGPURenderer } from 'three/webgpu'
import type { StudyScene } from './StudyScene'
import { TextCanvas } from '../text/canvas'
import { getLoopProgress } from '../animation/timeline'

export class RibbonScene implements StudyScene {
  readonly duration = 10
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(42, 1, 0.1, 100)
  private readonly width = 2
  private readonly curve = new CatmullRomCurve3([
    new Vector3(-4.6, -4.2, 0),
    new Vector3(-2.2, -2.8, 0.6),
    new Vector3(1.4, -1.2, 0.2),
    new Vector3(-1.4, 1.2, -0.6),
    new Vector3(2.2, 2.8, 0.3),
    new Vector3(4.6, 4.2, 0),
  ])
  private readonly frontGeometry = this.createFrontGeometry()
  private readonly backGeometry = this.createBackGeometry()
  // 明示的なNodeで、固定Meshでも毎フレームUV変換のuniformを更新する。
  private readonly frontMaterial = new MeshStandardNodeMaterial({
    color: 0xe8b49a, roughness: 0.9, metalness: 0, side: FrontSide,
    colorNode: materialColor,
  })
  private readonly backMaterial = new MeshStandardNodeMaterial({
    color: 0x8faabd, roughness: 0.9, metalness: 0, side: FrontSide,
    colorNode: materialColor,
  })
  private readonly textCanvas = new TextCanvas()
  private textTexture: CanvasTexture | null = null
  private textRevision = 0
  private time = 0
  private disposed = false

  constructor() {
    this.scene.background = new Color(0x171a20)
    this.camera.position.set(0, 0, 16)
    this.camera.lookAt(0, 0, 0)
    const fill = new HemisphereLight(0xffffff, 0x6b7485, 1.8)
    const key = new DirectionalLight(0xffffff, 2)
    key.position.set(-3, 5, 8)
    this.scene.add(
      new Mesh(this.frontGeometry, this.frontMaterial),
      new Mesh(this.backGeometry, this.backMaterial),
      fill, key,
    )
  }

  private createFrontGeometry(): BufferGeometry {
    const segments = 256
    const columns = 8
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const length = this.curve.getLength()
    const tangent = this.curve.getTangentAt(0)
    const widthDirection = new Vector3(0, 0, 1).cross(tangent).normalize()
    const transport = new Quaternion()
    for (let row = 0; row <= segments; row++) {
      const progress = row / segments
      const center = this.curve.getPointAt(progress)
      const nextTangent = this.curve.getTangentAt(progress)
      // 幅方向を前の接線から運び、曲率が変わっても急に裏返らないようにする。
      transport.setFromUnitVectors(tangent, nextTangent)
      widthDirection.applyQuaternion(transport).normalize()
      tangent.copy(nextTangent)
      const twist = Math.PI * progress * progress * (3 - 2 * progress)
      const across = widthDirection.clone().applyAxisAngle(tangent, twist)
      for (let column = 0; column <= columns; column++) {
        const v = column / columns
        const point = center.clone().addScaledVector(across, (v - 0.5) * this.width)
        positions.push(point.x, point.y, point.z)
        // 画像の4:1の比率に合わせ、Uを中心線の実距離で割り当てる。
        uvs.push(progress * length / (this.width * 4), v)
        if (row < segments && column < columns) {
          const a = row * (columns + 1) + column
          const b = a + 1
          const c = a + columns + 1
          const d = c + 1
          indices.push(a, c, b, b, c, d)
        }
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
  }

  private createBackGeometry(): BufferGeometry {
    const geometry = this.frontGeometry.clone()
    const index = geometry.getIndex()!
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1)
      index.setX(i + 1, index.getX(i + 2))
      index.setX(i + 2, b)
    }
    const normal = geometry.getAttribute('normal')
    const uv = geometry.getAttribute('uv')
    for (let i = 0; i < normal.count; i++) {
      normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i))
      // Uを共通に保ち、裏面の文字は幅方向だけ反転して読める向きにする。
      uv.setY(i, 1 - uv.getY(i))
    }
    return geometry
  }

  update(time: number): void {
    this.time = time
    if (this.textTexture) {
      this.textTexture.offset.x = -getLoopProgress(time, this.duration)
      // GPUへuniformが送られる前に、offsetを変換行列へ反映する。
      this.textTexture.updateMatrix()
    }
  }

  async setText(text: string): Promise<void> {
    if (this.disposed) throw new Error('破棄されたシーンにはテキストを反映できません。')
    const revision = ++this.textRevision
    const canvas = await this.textCanvas.draw(text, {
      width: 1024, height: 256,
      fontFamily: 'Noto Sans JP', fontWeight: 700,
      fontSize: 48, minFontSize: 16, lineHeight: 1.6, letterSpacing: 1,
      textAlign: 'left', color: '#15171b', background: '#ffffff', padding: 32,
      pixelRatio: Math.min(Math.max(window.devicePixelRatio, 1), 2),
    })
    if (this.disposed || revision !== this.textRevision) return
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.offset.x = -getLoopProgress(this.time, this.duration)
    texture.updateMatrix()
    this.frontMaterial.map = this.backMaterial.map = texture
    this.frontMaterial.needsUpdate = this.backMaterial.needsUpdate = true
    this.textTexture?.dispose()
    this.textTexture = texture
  }

  render(renderer: WebGPURenderer): void {
    renderer.render(this.scene, this.camera)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.zoom = Math.min(1, this.camera.aspect)
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.textRevision++
    this.frontMaterial.map = this.backMaterial.map = null
    this.textTexture?.dispose()
    this.textTexture = null
    this.frontGeometry.dispose()
    this.backGeometry.dispose()
    this.frontMaterial.dispose()
    this.backMaterial.dispose()
    this.scene.clear()
  }
}
