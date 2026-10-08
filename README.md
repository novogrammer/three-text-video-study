# three-text-video-study

日本語テキストを使った3D表現と動画生成を研究する習作プロジェクトです。

目的・技術構成・描画や動画書き出しの要件は [共通仕様](docs/spec.md) を参照してください。実装・作業時のルールは [AGENTS.md](AGENTS.md) にまとめています。

## 現在の状態

Cubeが浮遊・回転するシーンとMP4書き出しを実装しています。テキスト描画は未実装です。

解像度（512 × 512 / 1024 × 1024）、フレームレート（30 / 60fps）、品質（低 / 標準 / 高）を選び、「MP4を書き出す」を押します。Sceneの周期1回分を生成し、完了後に「MP4を保存」からダウンロードできます。「書き出した動画を確認」で生成結果を再生できます。H.264エンコードに対応したブラウザーが必要です。

## 開発方法

依存パッケージをインストールして、開発サーバーを起動します。

```sh
npm install
npm run dev
```

開発サーバーが表示するローカルURLをブラウザーで開いてください。

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | ローカル開発サーバーを起動 |
| `npm run build` | TypeScriptのチェックと本番用ビルド |
| `npm run preview` | ビルド結果をローカルで確認（ビルド後に実行） |

## ファイルの入口

| ファイル | 役割 |
| --- | --- |
| `index.html` | ページのHTML構造 |
| `src/main.ts` | TypeScriptのエントリーポイント |
| `src/app/Application.ts` | Renderer、描画ループ、設定UIの管理 |
| `src/scenes/CubeScene.ts` | 最初のCubeシーン |
| `src/scenes/StudyScene.ts` | シーンの共通インターフェース |
| `src/animation/timeline.ts` | 時刻からループ進行値への変換 |
| `src/rendering/SceneRenderer.ts` | 共通の描画結果の保持、プレビュー表示、フレーム取得 |
| `src/rendering/PixelFrame.ts` | RGBAピクセルのデータ形式と行の整形 |
| `src/video/VideoExporter.ts` | 固定フレームレートのMP4生成 |
| `src/video/settings.ts` | 書き出し設定の型 |
| `src/style.scss` | スタイルのエントリーポイント |
| `docs/spec.md` | 共通仕様と初期プロトタイプの要件 |
| `AGENTS.md` | 実装規約と作業上の制約 |

機能を追加する際の責務分割は、共通仕様の「構成方針」を参照してください。
