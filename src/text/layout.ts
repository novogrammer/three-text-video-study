import { loadDefaultJapaneseParser } from 'budoux'

export class TextLayout {
  private readonly parser = loadDefaultJapaneseParser()
  private readonly segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' })

  wrap(text: string, maxWidth: number, measure: (text: string) => number): string[] {
    const lines: string[] = []
    for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
      let line = ''
      for (const chunk of this.parser.parse(paragraph)) {
        if (measure(line + chunk) <= maxWidth) {
          line += chunk
          continue
        }
        if (line) lines.push(line)
        line = ''
        // 長い文節・英単語も、絵文字や結合文字を壊さず幅に収める。
        for (const { segment } of this.segmenter.segment(chunk)) {
          if (line && measure(line + segment) > maxWidth) {
            lines.push(line)
            line = ''
          }
          line += segment
        }
      }
      lines.push(line)
    }
    return lines
  }
}
