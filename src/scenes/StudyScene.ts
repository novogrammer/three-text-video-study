import type { Camera, Scene, Texture } from 'three/webgpu'

/** Rendererを持たず、表現と時刻による状態更新を担当する。 */
export interface StudyScene {
  readonly scene: Scene
  readonly camera: Camera
  /** ループの周期。秒単位の正の値。 */
  readonly duration: number
  /** テクスチャの所有・破棄は呼び出し側が担当する。 */
  setTexture(texture: Texture): void
  update(time: number): void
  resize(width: number, height: number): void
  dispose(): void
}
