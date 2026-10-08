/** 上から下へ並んだ、隙間のないRGBA8・sRGBのピクセル。 */
export interface PixelFrame {
  readonly width: number
  readonly height: number
  readonly pixels: Uint8Array
}

/** WebGPUの行パディングと、WebGLの上下方向の違いを吸収する。 */
export function packRgbaRows(source: Uint8Array, width: number, height: number, flipY: boolean): Uint8Array {
  const rowBytes = width * 4
  const packedLength = rowBytes * height
  const paddedRowBytes = Math.ceil(rowBytes / 256) * 256
  const stride = source.length === packedLength ? rowBytes : paddedRowBytes
  if (source.length < (height - 1) * stride + rowBytes) {
    throw new Error('取得したRGBAフレームのサイズが不正です。')
  }

  const pixels = new Uint8Array(packedLength)
  for (let y = 0; y < height; y++) {
    const sourceY = flipY ? height - 1 - y : y
    pixels.set(source.subarray(sourceY * stride, sourceY * stride + rowBytes), y * rowBytes)
  }
  return pixels
}
