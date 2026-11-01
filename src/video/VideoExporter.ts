import {
  BufferTarget,
  VideoSample,
  VideoSampleSource,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeVideo,
} from 'mediabunny'
import type { VideoSettings } from './settings'
import { ExportDiagnostics } from './ExportDiagnostics'
import type { PixelFrame } from '../rendering/PixelFrame'

/** 指定時刻を描画して、独立したピクセルデータを取得する。 */
export type CaptureFrame = (time: number, onStage?: (stage: string) => void) => Promise<PixelFrame>

export class VideoExporter {
  async export(
    settings: VideoSettings,
    duration: number,
    captureFrame: CaptureFrame,
    signal: AbortSignal,
    onProgress: (completed: number, total: number) => void,
  ): Promise<Blob> {
    const quality = new Quality(settings.quality)

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Sceneの周期は正の秒数にしてください。')
    }

    const frameCount = Math.round(duration * settings.frameRate)
    if (frameCount < 1 || Math.abs(frameCount / settings.frameRate - duration) > 1e-6) {
      throw new Error('Sceneの周期を、選択したフレームレートの整数フレーム分にしてください。')
    }

    const diagnostics = new ExportDiagnostics(signal)
    try {
      return await this.encode(settings, frameCount, quality, captureFrame, signal, onProgress, diagnostics)
    } catch (error) {
      console.error('[record]', JSON.stringify({ event: 'error', error: String(error), aborted: signal.aborted }))
      throw error
    } finally {
      diagnostics.dispose()
    }
  }

  private async encode(
    settings: VideoSettings,
    frameCount: number,
    quality: Quality,
    captureFrame: CaptureFrame,
    signal: AbortSignal,
    onProgress: (completed: number, total: number) => void,
    diagnostics: ExportDiagnostics,
  ): Promise<Blob> {
    // Baseline: level 3.2 (30fps), level 4.0 (1024-square at 60fps).
    const fullCodecString = settings.frameRate > 30 ? 'avc1.420028' : 'avc1.420020'
    let submitted = 0
    let packets = 0
    const log = (event: string, details: object = {}): void => {
      console.info('[encoder]', JSON.stringify({ event, ...details }))
    }
    diagnostics.mark('support:start')
    log('support:start', { ...settings, fullCodecString })
    const supported = await canEncodeVideo('avc', {
      width: settings.resolution,
      height: settings.resolution,
      frameRate: settings.frameRate,
      quality,
      fullCodecString,
    })
    log('support:done', { supported })
    signal.throwIfAborted()
    if (!supported) {
      throw new Error('このブラウザーでは選択した設定でH.264動画を書き出せません。')
    }

    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
    const source = new VideoSampleSource({
      codec: 'avc', quality, fullCodecString,
      onEncoderConfig: config => { log('config:candidate', config) },
      onEncodedPacket: packet => {
        packets++
        if (packets <= 20 || packets % 60 === 0) log('packet', { packet: packets, timestamp: packet.timestamp })
      },
    })
    output.addVideoTrack(source, { frameRate: settings.frameRate })

    try {
      diagnostics.mark('output:start')
      await output.start()
      log('output:ready')
      for (let frame = 0; frame < frameCount; frame++) {
        signal.throwIfAborted()
        const time = frame / settings.frameRate
        diagnostics.beginFrame(frame, time)
        diagnostics.mark('capture:start')
        const pixels = await captureFrame(time, diagnostics.mark)
        signal.throwIfAborted()
        if (pixels.width !== settings.resolution || pixels.height !== settings.resolution
          || pixels.pixels.length !== pixels.width * pixels.height * 4) {
          throw new Error('取得したフレームが書き出し設定と一致しません。')
        }
        const sample = new VideoSample(pixels.pixels, {
          format: 'RGBA',
          codedWidth: pixels.width,
          codedHeight: pixels.height,
          timestamp: time,
          duration: 1 / settings.frameRate,
          colorSpace: { primaries: 'bt709', transfer: 'iec61966-2-1', matrix: 'rgb', fullRange: true },
        })
        try {
          diagnostics.mark('encode:start')
          await source.add(sample)
          submitted++
          diagnostics.mark('encode:done')
        } finally {
          sample.close()
        }
        onProgress(frame + 1, frameCount)
      }
      signal.throwIfAborted()
      source.close()
      diagnostics.mark('finalize:start')
      log('finalize:start', { submitted, packets })
      await output.finalize()
      log('finalize:done', { submitted, packets, expected: frameCount })
      signal.throwIfAborted()

      if (!output.target.buffer) throw new Error('MP4データを取得できませんでした。')
      return new Blob([output.target.buffer], { type: 'video/mp4' })
    } catch (error) {
      console.error('[encoder]', JSON.stringify({ event: 'error', error: String(error), submitted, packets }))
      diagnostics.mark('cancel:start')
      if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel()
      throw error
    }
  }
}
