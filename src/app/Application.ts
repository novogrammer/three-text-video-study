import { WebGPURenderer } from 'three/webgpu'
import type { StudyScene } from '../scenes/StudyScene'

export class Application {
  private readonly renderer: WebGPURenderer
  private readonly viewport: HTMLElement
  private readonly status: HTMLElement
  private readonly activeScene: StudyScene
  private readonly resizeObserver: ResizeObserver
  private startTime: number | null = null
  private initialized = false
  private disposed = false

  constructor(
    canvas: HTMLCanvasElement,
    viewport: HTMLElement,
    status: HTMLElement,
    scene: StudyScene,
  ) {
    this.renderer = new WebGPURenderer({ canvas, antialias: true })
    this.viewport = viewport
    this.status = status
    this.activeScene = scene
    this.resizeObserver = new ResizeObserver(this.resize)
  }

  async start(): Promise<void> {
    await this.renderer.init()
    this.initialized = true

    // 初期化を待つ間にHMRなどで破棄された場合も、GPUリソースを解放する。
    if (this.disposed) {
      await this.renderer.dispose()
      return
    }

    this.resize()
    this.resizeObserver.observe(this.viewport)
    window.addEventListener('resize', this.resize)
    await this.renderer.setAnimationLoop(this.render)

    const backend = 'isWebGPUBackend' in this.renderer.backend ? 'WebGPU' : 'WebGL 2'
    this.status.textContent = `${backend} / ${this.activeScene.duration}秒ループ / 描画中`
  }

  private readonly resize = (): void => {
    if (this.disposed) return

    const width = Math.max(1, this.viewport.clientWidth)
    const height = Math.max(1, this.viewport.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height, false)
    this.activeScene.resize(width, height)
  }

  private readonly render = (timestamp: number): void => {
    if (this.disposed) return
    this.startTime ??= timestamp
    const time = (timestamp - this.startTime) / 1000

    try {
      this.activeScene.update(time)
      this.renderer.render(this.activeScene.scene, this.activeScene.camera)
    } catch (error) {
      console.error(error)
      this.status.textContent = '描画中にエラーが発生しました。コンソールを確認してください。'
      void this.dispose()
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.resizeObserver.disconnect()
    window.removeEventListener('resize', this.resize)
    if (this.initialized) await this.renderer.setAnimationLoop(null)
    this.activeScene.dispose()
    if (this.initialized) await this.renderer.dispose()
  }
}
