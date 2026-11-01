/** 書き出し中だけ処理段階を記録し、停滞しても処理自体は中断しない。 */
export class ExportDiagnostics {
  private stage = 'start'
  private frame = -1
  private time = 0
  private since = performance.now()
  private readonly timer: ReturnType<typeof setInterval>

  constructor(signal: AbortSignal) {
    this.timer = setInterval(() => {
      const elapsedMs = Math.round(performance.now() - this.since)
      if (elapsedMs >= 5000) {
        console.warn('[record]', JSON.stringify({
          event: 'waiting', stage: this.stage, frame: this.frame, time: this.time,
          elapsedMs, aborted: signal.aborted, visibility: document.visibilityState,
        }))
      }
    }, 5000)
  }

  beginFrame(frame: number, time: number): void {
    this.frame = frame
    this.time = time
  }

  readonly mark = (stage: string): void => {
    this.stage = stage
    this.since = performance.now()
    if (this.frame < 20 || this.frame % 60 === 0) {
      console.info('[record]', JSON.stringify({ event: stage, frame: this.frame, time: this.time }))
    }
  }

  dispose(): void {
    clearInterval(this.timer)
  }
}
