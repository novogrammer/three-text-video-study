export async function loadTextFont(font: string, text: string): Promise<void> {
  if (!text.trim()) return
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const fonts = await Promise.race([
      document.fonts.load(font, text),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Webフォントの読み込みがタイムアウトしました。もう一度反映してください。')), 15000)
      }),
    ])
    if (fonts.length === 0) throw new Error('Webフォントを読み込めません。ネットワーク接続を確認してください。')
  } finally {
    clearTimeout(timeout)
  }
}
