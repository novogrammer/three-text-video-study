import {
  MeshBasicNodeMaterial,
  NoToneMapping,
  QuadMesh,
  RenderTarget,
  SRGBColorSpace,
  UnsignedByteType,
  WebGPURenderer,
} from 'three/webgpu'
import { sRGBTransferEOTF, texture, vec3 } from 'three/tsl'
import type { StudyScene } from '../scenes/StudyScene'
import { packRgbaRows } from './PixelFrame'
import type { PixelFrame } from './PixelFrame'

/** 表示と書き出しが共有する、一枚の出力画像を保持する。 */
export class SceneRenderer {
  private readonly renderer: WebGPURenderer
  private readonly frameTarget = new RenderTarget(1024, 1024, { type: UnsignedByteType })
  private readonly displayMaterial = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false })
  private readonly display = new QuadMesh(this.displayMaterial)

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGPURenderer({ canvas, antialias: true, alpha: false })
    this.renderer.setPixelRatio(1)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = NoToneMapping

    // 出力パスが既にsRGBへ変換している。表示時に二重変換しないよう戻す。
    this.displayMaterial.colorNode = sRGBTransferEOTF(texture(this.frameTarget.texture).rgb) as ReturnType<typeof vec3>
  }

  get backendName(): string {
    return 'isWebGPUBackend' in this.renderer.backend ? 'WebGPU' : 'WebGL 2'
  }

  async init(): Promise<void> {
    await this.renderer.init()
  }

  setResolution(size: number): void {
    this.frameTarget.setSize(size, size)
    this.renderer.setSize(size, size, false)
  }

  async setAnimationLoop(callback: ((timestamp: number) => void) | null): Promise<void> {
    await this.renderer.setAnimationLoop(callback)
  }

  /** setAnimationLoopのコールバック内から呼ぶ。 */
  render(scene: StudyScene): void {
    // Canvasと同じ色変換・アンチエイリアスを適用した出力を保持する。
    this.renderer.setOutputRenderTarget(this.frameTarget)
    try {
      scene.render(this.renderer)
    } finally {
      this.renderer.setRenderTarget(null)
      this.renderer.setOutputRenderTarget(null)
    }
    this.display.render(this.renderer)
  }

  async readFrame(): Promise<PixelFrame> {
    const { width, height } = this.frameTarget
    // 非同期readbackが完了するまで待つ。Canvasの表示タイミングには依存しない。
    const source = await this.renderer.readRenderTargetPixelsAsync(this.frameTarget, 0, 0, width, height)
    if (!(source instanceof Uint8Array)) throw new Error('RGBA8のピクセルを取得できませんでした。')
    const flipY = 'isWebGLBackend' in this.renderer.backend
    return { width, height, pixels: packRgbaRows(source, width, height, flipY) }
  }

  async dispose(): Promise<void> {
    this.frameTarget.dispose()
    this.displayMaterial.dispose()
    await this.renderer.dispose()
  }
}
