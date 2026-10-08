import type { WebGPURenderer } from 'three/webgpu'

/** 表現、時刻による状態更新、シーン固有の描画を担当する。 */
export interface StudyScene {
  /** ループの周期。秒単位の正の値。 */
  readonly duration: number
  /** 文章からシーン固有の素材を生成・反映する。素材の所有・破棄もシーンが担当する。 */
  setText(text: string): Promise<void>
  update(time: number): void
  /** 共通側が設定した最終出力先へ描画する。Rendererと描画ループは所有しない。 */
  render(renderer: WebGPURenderer): void
  resize(width: number, height: number): void
  dispose(): void
}
