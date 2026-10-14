import { TorusScene } from './TorusScene'
import { VaporwaveScene } from './VaporwaveScene'
import { RibbonScene } from './RibbonScene'
import type { StudyScene } from './StudyScene'

export interface SceneDefinition {
  id: string
  number: string
  title: string
  create: () => StudyScene
}

export function getSceneDefinition(id: string): SceneDefinition {
  switch (id) {
    case 'torus':
      return { id, number: '01', title: 'Torus · 内側を巡る', create: () => new TorusScene() }
    case 'vaporwave':
      return { id, number: '02', title: 'Vaporwave · ネオンの道', create: () => new VaporwaveScene() }
    case 'ribbon':
      return { id, number: '03', title: 'Ribbon · ねじれた文章', create: () => new RibbonScene() }
    default:
      throw new Error('シーンの指定が不正です。')
  }
}
