import type { Texture, WebGPURenderer } from 'three/webgpu'

/** 表現、時刻による状態更新、シーン固有の描画を担当する。 */
export interface StudyScene {
  /** ループの周期。秒単位の正の値。 */
  readonly duration: number
  /** テクスチャの所有・破棄は呼び出し側が担当する。 */
  setTexture(texture: Texture): void
  update(time: number): void
  /** 共通側が設定した最終出力先へ描画する。Rendererと描画ループは所有しない。 */
  render(renderer: WebGPURenderer): void
  resize(width: number, height: number): void
  dispose(): void
}
