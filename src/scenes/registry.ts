import { CubeScene } from './CubeScene'
import { TorusScene } from './TorusScene'
import { VaporwaveScene } from './VaporwaveScene'
import type { StudyScene } from './StudyScene'

export interface SceneDefinition {
  id: string
  number: string
  title: string
  create: () => StudyScene
}

export function getSceneDefinition(id: string): SceneDefinition {
  switch (id) {
    case 'cube':
      return { id, number: '01', title: 'Cube · 浮遊と回転', create: () => new CubeScene() }
    case 'torus':
      return { id, number: '02', title: 'Torus · 内側を巡る', create: () => new TorusScene() }
    case 'vaporwave':
      return { id, number: '03', title: 'Vaporwave · ネオンの道', create: () => new VaporwaveScene() }
    default:
      throw new Error('シーンの指定が不正です。')
  }
}
