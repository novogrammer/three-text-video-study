import { WebGPURenderer } from 'three/webgpu'
import type { StudyScene } from '../scenes/StudyScene'
import { VideoExporter } from '../video/VideoExporter'
import type { CaptureFrame } from '../video/VideoExporter'
import type { VideoSettings } from '../video/settings'

export interface ApplicationElements {
  canvas: HTMLCanvasElement
  status: HTMLElement
  settings: HTMLFieldSetElement
  resolution: HTMLSelectElement
  frameRate: HTMLSelectElement
  quality: HTMLSelectElement
  exportButton: HTMLButtonElement
  download: HTMLAnchorElement
  result: HTMLDetailsElement
  video: HTMLVideoElement
}

interface FrameRequest {
  time: number
  capture: () => Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
}

export class Application {
  private readonly renderer: WebGPURenderer
  private readonly elements: ApplicationElements
  private readonly activeScene: StudyScene
  private readonly exporter = new VideoExporter()
  private startTime: number | null = null
  private initialized = false
  private disposed = false
  private exporting = false
  private pendingFrame: FrameRequest | null = null
  private exportController: AbortController | null = null
  private downloadUrl: string | null = null
  private backend = ''

  constructor(elements: ApplicationElements, scene: StudyScene) {
    this.renderer = new WebGPURenderer({ canvas: elements.canvas, antialias: true })
    this.elements = elements
    this.activeScene = scene
  }

  async start(): Promise<void> {
    await this.renderer.init()
    this.initialized = true

    // 初期化を待つ間にHMRなどで破棄された場合も、GPUリソースを解放する。
    if (this.disposed) {
      await this.renderer.dispose()
      return
    }

    this.applyResolution()
    this.elements.resolution.addEventListener('change', this.applyResolution)
    this.elements.exportButton.addEventListener('click', this.exportVideo)
    await this.renderer.setAnimationLoop(this.render)

    this.backend = 'isWebGPUBackend' in this.renderer.backend ? 'WebGPU' : 'WebGL 2'
    this.elements.exportButton.disabled = false
    this.showPreviewStatus()
  }

  private readSettings(): VideoSettings {
    const resolution = Number(this.elements.resolution.value)
    const frameRate = Number(this.elements.frameRate.value)
    const quality = this.elements.quality.value
    if ((resolution !== 512 && resolution !== 1024)
      || (frameRate !== 30 && frameRate !== 60)
      || (quality !== 'low' && quality !== 'medium' && quality !== 'high')) {
      throw new Error('書き出し設定が不正です。')
    }
    return { resolution, frameRate, quality }
  }

  private showPreviewStatus(): void {
    const size = this.elements.canvas.width
    this.elements.status.textContent = `${this.backend} / ${size} × ${size} / ${this.activeScene.duration}秒ループ`
  }

  private readonly applyResolution = (): void => {
    if (this.disposed || this.exporting) return
    const { resolution } = this.readSettings()
    // 出力の実ピクセル数を固定し、画面へのフィットはCSSに任せる。
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(resolution, resolution, false)
    this.activeScene.resize(resolution, resolution)
    if (this.backend) this.showPreviewStatus()
  }

  private readonly render = (timestamp: number): void => {
    if (this.disposed) return
    const request = this.pendingFrame
    if (this.exporting && !request) return
    this.pendingFrame = null
    this.startTime ??= timestamp
    const time = request ? request.time : (timestamp - this.startTime) / 1000

    try {
      this.activeScene.update(time)
      this.renderer.render(this.activeScene.scene, this.activeScene.camera)
      // 同じコールバック内でCanvasを取得し、次の描画による上書きを防ぐ。
      if (request) void request.capture().then(request.resolve, request.reject)
    } catch (error) {
      console.error(error)
      if (request) {
        request.reject(error)
      } else {
        this.elements.status.textContent = '描画中にエラーが発生しました。コンソールを確認してください。'
        void this.dispose()
      }
    }
  }

  private readonly captureFrame: CaptureFrame = (time, capture) => {
    if (this.disposed || !this.exporting || this.pendingFrame) {
      return Promise.reject(new Error('書き出し用のフレームを要求できません。'))
    }
    return new Promise<void>((resolve, reject) => {
      this.pendingFrame = { time, capture, resolve, reject }
    })
  }

  private readonly exportVideo = async (): Promise<void> => {
    if (this.disposed || !this.initialized || this.exporting) return
    this.exporting = true
    this.elements.settings.disabled = true
    this.elements.download.hidden = true
    this.elements.result.hidden = true
    this.elements.video.pause()
    this.elements.status.textContent = '書き出しを準備しています…'
    const controller = new AbortController()
    this.exportController = controller

    try {
      const settings = this.readSettings()
      const blob = await this.exporter.export(
        this.elements.canvas,
        settings,
        this.activeScene.duration,
        this.captureFrame,
        controller.signal,
        (completed, total) => {
          if (!this.disposed) {
            this.elements.status.textContent = completed === total
              ? 'MP4を仕上げています…'
              : `書き出し中 ${Math.floor(completed / total * 100)}% (${completed} / ${total})`
          }
        },
      )
      if (this.disposed) return
      if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl)
      this.downloadUrl = URL.createObjectURL(blob)
      this.elements.download.href = this.downloadUrl
      this.elements.download.download = `scene-${settings.resolution}-${settings.frameRate}fps-${settings.quality}.mp4`
      this.elements.download.hidden = false
      this.elements.video.src = this.downloadUrl
      this.elements.result.hidden = false
      this.elements.status.textContent = `${this.activeScene.duration}秒のMP4を書き出しました。`
    } catch (error) {
      if (!this.disposed) {
        console.error(error)
        this.elements.status.textContent = error instanceof Error ? error.message : '書き出しに失敗しました。'
      }
    } finally {
      this.exporting = false
      this.exportController = null
      this.startTime = null
      if (!this.disposed) {
        this.elements.settings.disabled = false
        // 失敗した場合も、前回正常に生成できた動画は再び保存・確認できる。
        this.elements.download.hidden = this.downloadUrl === null
        this.elements.result.hidden = this.downloadUrl === null
      }
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.exportController?.abort()
    this.pendingFrame?.reject(new Error('アプリが破棄されました。'))
    this.pendingFrame = null
    this.elements.settings.disabled = true
    this.elements.resolution.removeEventListener('change', this.applyResolution)
    this.elements.exportButton.removeEventListener('click', this.exportVideo)
    if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl)
    this.elements.video.removeAttribute('src')
    this.elements.video.load()
    if (this.initialized) await this.renderer.setAnimationLoop(null)
    this.activeScene.dispose()
    if (this.initialized) await this.renderer.dispose()
  }
}
