import './style.scss'
import { Application } from './app/Application'
import { getSceneDefinition } from './scenes/registry'

function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`HTML要素が見つかりません: ${selector}`)
  return element
}

const status = getElement<HTMLElement>('[data-status]')
const sceneSelect = getElement<HTMLSelectElement>('[data-scene]')
const application = new Application({
  sceneSelect,
  sceneTitle: getElement<HTMLElement>('[data-scene-title]'),
  sceneNumber: getElement<HTMLElement>('[data-scene-number]'),
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
}, getSceneDefinition(sceneSelect.value))

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
