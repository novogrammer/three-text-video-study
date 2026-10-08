import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  canEncodeVideo,
} from 'mediabunny'
import type { VideoSettings } from './settings'

/** 描画ループ内で指定時刻を描画し、その直後にcaptureを呼ぶ。 */
export type CaptureFrame = (time: number, capture: () => Promise<void>) => Promise<void>

export class VideoExporter {
  async export(
    canvas: HTMLCanvasElement,
    settings: VideoSettings,
    duration: number,
    captureFrame: CaptureFrame,
    signal: AbortSignal,
    onProgress: (completed: number, total: number) => void,
  ): Promise<Blob> {
    const quality = {
      low: QUALITY_LOW,
      medium: QUALITY_MEDIUM,
      high: QUALITY_HIGH,
    }[settings.quality]

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Sceneの周期は正の秒数にしてください。')
    }

    const frameCount = Math.round(duration * settings.frameRate)
    if (frameCount < 1 || Math.abs(frameCount / settings.frameRate - duration) > 1e-6) {
      throw new Error('Sceneの周期を、選択したフレームレートの整数フレーム分にしてください。')
    }

    const supported = await canEncodeVideo('avc', {
      width: settings.resolution,
      height: settings.resolution,
      frameRate: settings.frameRate,
      quality,
    })
    signal.throwIfAborted()
    if (!supported) {
      throw new Error('このブラウザーでは選択した設定でH.264動画を書き出せません。')
    }

    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
    const source = new CanvasSource(canvas, { codec: 'avc', quality })
    output.addVideoTrack(source, { frameRate: settings.frameRate })

    try {
      await output.start()
      for (let frame = 0; frame < frameCount; frame++) {
        signal.throwIfAborted()
        const time = frame / settings.frameRate
        // Canvas取得を描画直後に行い、エンコーダーが次のframeを受け取れるまで待つ。
        await captureFrame(time, () => source.add(time, 1 / settings.frameRate))
        onProgress(frame + 1, frameCount)
      }
      signal.throwIfAborted()
      source.close()
      await output.finalize()
      signal.throwIfAborted()

      if (!output.target.buffer) throw new Error('MP4データを取得できませんでした。')
      return new Blob([output.target.buffer], { type: 'video/mp4' })
    } catch (error) {
      if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel()
      throw error
    }
  }
}
