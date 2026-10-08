import './style.scss'
import { Application } from './app/Application'
import { CubeScene } from './scenes/CubeScene'

const viewport = document.querySelector<HTMLElement>('[data-viewport]')
const canvas = document.querySelector<HTMLCanvasElement>('[data-canvas]')
const status = document.querySelector<HTMLElement>('[data-status]')

if (!viewport || !canvas || !status) {
  throw new Error('描画に必要なHTML要素が見つかりません。')
}

const application = new Application(canvas, viewport, status, new CubeScene())

void application.start().catch((error: unknown) => {
  console.error(error)
  status.textContent = '描画を開始できませんでした。ブラウザーのGPU対応とコンソールを確認してください。'
  void application.dispose()
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void application.dispose()
  })
}
