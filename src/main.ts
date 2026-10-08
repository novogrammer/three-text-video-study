import './style.scss'
import { Application } from './app/Application'
import { CubeScene } from './scenes/CubeScene'

function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`HTML要素が見つかりません: ${selector}`)
  return element
}

const status = getElement<HTMLElement>('[data-status]')
const application = new Application({
  canvas: getElement<HTMLCanvasElement>('[data-canvas]'),
  status,
  settings: getElement<HTMLFieldSetElement>('[data-settings]'),
  resolution: getElement<HTMLSelectElement>('[data-resolution]'),
  frameRate: getElement<HTMLSelectElement>('[data-frame-rate]'),
  quality: getElement<HTMLSelectElement>('[data-quality]'),
  exportButton: getElement<HTMLButtonElement>('[data-export]'),
  download: getElement<HTMLAnchorElement>('[data-download]'),
  result: getElement<HTMLDetailsElement>('[data-result]'),
  video: getElement<HTMLVideoElement>('[data-video]'),
  textSettings: getElement<HTMLFieldSetElement>('[data-text-settings]'),
  text: getElement<HTMLTextAreaElement>('[data-text]'),
  applyTextButton: getElement<HTMLButtonElement>('[data-apply-text]'),
}, new CubeScene())

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
