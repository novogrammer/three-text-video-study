import type { Camera, Scene } from 'three/webgpu'

/** Rendererを持たず、表現と時刻による状態更新を担当する。 */
export interface StudyScene {
  readonly scene: Scene
  readonly camera: Camera
  update(time: number): void
  resize(width: number, height: number): void
  dispose(): void
}
