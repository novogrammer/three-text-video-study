import { loadTextFont } from './font'
import { TextLayout } from './layout'

export interface TextCanvasOptions {
  width: number
  height: number
  fontFamily: string
  fontWeight: number
  fontSize: number
  /** フォントサイズに対する倍率。 */
  lineHeight: number
  letterSpacing: number
  textAlign: 'left' | 'center' | 'right'
  color: string
  background: string
  padding: number
  pixelRatio: number
  minFontSize: number
}

export class TextCanvas {
  private readonly layout = new TextLayout()

  async draw(text: string, options: TextCanvasOptions): Promise<HTMLCanvasElement> {
    const font = (size: number) => `${options.fontWeight} ${size}px "${options.fontFamily}"`
    await loadTextFont(font(options.fontSize), text)

    // 描画用の素材Canvas。ページのDOM構造には追加しない。
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(options.width * options.pixelRatio)
    canvas.height = Math.round(options.height * options.pixelRatio)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('テキスト描画用のCanvasを作成できません。')
    context.scale(options.pixelRatio, options.pixelRatio)
    context.letterSpacing = `${options.letterSpacing}px`

    let size = options.fontSize
    let lines: string[] = []
    const maxWidth = options.width - options.padding * 2
    const maxHeight = options.height - options.padding * 2
    for (; size >= options.minFontSize; size -= 2) {
      context.font = font(size)
      lines = this.layout.wrap(text, maxWidth, line => context.measureText(line).width)
      if (lines.length * size * options.lineHeight <= maxHeight) break
    }
    if (size < options.minFontSize) throw new Error('文章が面に収まりません。文章や改行を少なくしてください。')

    context.fillStyle = options.background
    context.fillRect(0, 0, options.width, options.height)
    context.fillStyle = options.color
    context.textAlign = options.textAlign
    context.textBaseline = 'top'
    const x = options.textAlign === 'center' ? options.width / 2
      : options.textAlign === 'right' ? options.width - options.padding : options.padding
    lines.forEach((line, index) => context.fillText(line, x, options.padding + index * size * options.lineHeight))
    return canvas
  }
}
