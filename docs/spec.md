# three-text-video-study

## 概要

Three.jsを使って、入力されたテキストから短い動画を生成する仕組みを研究するための習作プロジェクト。

テキストはWebフォントを使用してCanvas 2Dへ描画し、そのCanvasをThree.jsのテクスチャとして利用する。

Three.js側の表現は特定のシーンに固定せず、複数の表現を試せる構造にする。

最終的にMediabunnyを使ってMP4を書き出す。

## 主な研究対象

* WebフォントをCanvas 2Dへ安定して描画する
* 日本語テキストを扱う
* 日本語の自然な改行を扱う
* CanvasをThree.jsのテクスチャとして利用する
* テキストを3D表現へ利用する
* 時刻から再現可能なアニメーションを作る
* ループ動画を生成できるようにする
* MediabunnyでMP4を書き出す
* シーンを差し替えて表現を追加できる構造にする

## 技術構成

* TypeScript
* Vite
* Three.js
* WebGPURenderer
* Canvas 2D
* Web Font
* BudouX
* Mediabunny

WebGPUを基本とする。

## テキスト入力

ユーザーが入力した日本語テキストをCanvas 2Dへ描画する。

描画前にWebフォントの読み込みを完了させる。

フォント読み込みには `document.fonts.load()` を使用し、実際に描画する文字列を第2引数として渡す。

```ts
await document.fonts.load(
  '700 64px "Noto Sans JP"',
  text,
);
```

Google Fontsに限定せず、通常のWebフォントでも同じ仕組みを利用する。

日本語Webフォントが `unicode-range` で分割されている場合も考慮する。

## 日本語の改行

Canvas 2DにはDOMのような自動改行がないため、簡単なテキストレイアウト処理を実装する。

BudouXを使って自然な改行候補を取得し、`measureText()` で実際の幅を計測する。

本格的な日本語組版エンジンの実装は目的としない。

初期段階では以下は対象外。

* ルビ
* 縦書き
* 高度な禁則処理
* 複数フォントの混在

## Canvas 2D

Canvas側でテキストのレイアウトと描画を完結させる。

少なくとも以下を指定できるようにする。

* width
* height
* fontFamily
* fontWeight
* fontSize
* lineHeight
* letterSpacing
* textAlign
* color
* padding

devicePixelRatioを考慮した解像度で描画する。

生成したCanvasは `THREE.CanvasTexture` としてThree.js側へ渡す。

## Three.js

Three.js側ではCanvasTextureを素材として使用する。

具体的な3D表現は固定しない。

例えば以下のような表現を試せる構造を想定する。

* 平面
* 曲面
* トンネル
* リボン
* 球体
* 円柱
* トーラス
* シェーダーによる変形

個々のシーン固有の仕様は、この共通仕様には含めない。

## Renderer

`WebGPURenderer` を使用する。

過去の検証で、WebGPURendererの描画を `setAnimationLoop()` の外で行った際に、影や描画結果が残るような問題が発生した経験がある。

そのため、本プロジェクトでは描画処理を原則として `renderer.setAnimationLoop()` 内で行う。

```ts
renderer.setAnimationLoop(() => {
  update();
  renderer.render(scene, camera);
});
```

プレビューと動画書き出しの両方で、このレンダーループの前提を崩さない構成にする。

## アニメーション

アニメーション状態は可能な限り絶対時刻から決定できる構造にする。

```ts
update(time: number): void
```

のように、時刻を渡せば同じ状態を再現できる設計を基本とする。

ループ表現では、

```ts
const progress = (time % duration) / duration;
```

のような0〜1の進行値を使用できるようにする。

物理シミュレーションなど、前フレームの状態へ強く依存する表現は初期段階では扱わない。

## プレビュー

通常のプレビューでは、`setAnimationLoop()` から取得できる時間を使ってアニメーションを更新する。

描画処理自体は常に `setAnimationLoop()` 内で行う。

## MP4書き出し

MP4の生成にはMediabunnyを使用する。

リアルタイム画面録画ではなく、固定フレームレートで動画を生成できる構造を目指す。

例えば60fpsの場合、

```text
frame 0   → time = 0 / 60
frame 1   → time = 1 / 60
frame 2   → time = 2 / 60
...
```

のように、書き出し側が描画時刻を制御する。

ただしWebGPURendererの描画は `setAnimationLoop()` 内で行う前提を維持する。

そのため動画書き出しでは、

* 書き出し対象のframe index
* そのframeに対応するtime
* render完了
* Canvasのframe取得
* Mediabunnyへの入力

を同期させる仕組みを設計する。

詳細な実装方法はプロトタイプを作りながら検証する。

## ループ動画

ループ動画の場合、開始状態と終了状態を一致させる。

対象は例えば以下。

* camera transform
* object transform
* shader uniform
* texture offset
* scene固有のanimation parameter

初期段階では周期関数や0〜1のprogressから状態を決められる表現を優先する。

## 構成方針

責務はなるべく分離する。

```text
src/
  text/
    font.ts
    layout.ts
    canvas.ts

  scenes/
    ...

  animation/
    timeline.ts

  video/
    exporter.ts

  app/
    main.ts
```

### text

Webフォント読み込み、日本語改行、Canvas描画を担当する。

### scenes

CanvasTextureを使用したThree.jsの各表現を担当する。

シーン固有の仕様は各scene側へ置く。

### animation

時刻とprogressの管理を担当する。

### video

Mediabunnyを使ったMP4生成を担当する。

Three.jsの描画ロジックとはできるだけ分離する。

## 初期プロトタイプ

まず以下を確認する。

1. 日本語テキストを入力できる
2. Webフォントを確実に読み込める
3. BudouXを使ってCanvas上で自動改行できる
4. CanvasTextureとしてThree.jsシーンへ表示できる
5. WebGPURendererを `setAnimationLoop()` で安定して描画できる
6. 時刻指定で同じアニメーション状態を再現できる
7. Mediabunnyへframeを渡してMP4を書き出せる

最初の3Dシーンは検証しやすい単純なものから始める。

シーンそのものの作り込みより、テキスト描画から動画書き出しまでのパイプラインを成立させることを優先する。

## 今回の基本方針

このプロジェクトでは、個別の表現を完成させることより、

```text
text
↓
Web Font
↓
Canvas 2D
↓
CanvasTexture
↓
Three.js
↓
setAnimationLoop
↓
frame
↓
Mediabunny
↓
MP4
```

という共通パイプラインを作ることを優先する。

表現はその上に追加していく。
