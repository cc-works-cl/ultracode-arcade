# ULTRA ARCADE — モジュール開発コントラクト

各コンポーネントは **1ファイル = 1モジュール** の独立した classic script。ビルド不要。
正典テンプレートは `js/tools/counter.js`。必ず読んで同じ形をミラーすること。

## 鉄則
1. ファイル全体を **IIFE** で包む。唯一許されるグローバル副作用は `Arcade.register({...})` の呼び出しのみ。
2. **`index.html` / `css/base.css` / `js/core.js` / 他モジュールを絶対に編集しない。** 自分の担当ファイルだけを作成する。
3. 外部CDN・ネットワーク依存は禁止。純粋な vanilla JS のみ。
4. 仕上げに `node --check <自分のファイル>` を実行し、構文エラーが無いことを確認する。

## 登録 API
```js
Arcade.register({
  id: 'breakout',          // 一意なkebab-case
  category: 'game',        // 'game' | 'tool' | 'studio'
  title: 'ブロック崩し',
  subtitle: '一行説明（任意）',
  icon: '🧱',              // 絵文字
  color: '#ff4d57',        // タイルのアクセント色(hex)
  order: 10,               // カテゴリ内の並び順
  mount: function (root, ctx) { /* root に UI を構築 */ },
  unmount: function () { /* 全てのタイマー/RAF/音/ストリーム/監視を停止 */ }
});
```

- `mount(root, ctx)`: `root` は `.screen-content`（ヘッダー下のフルハイト flex column）。ここに UI を構築する。
- `unmount()`: **必ず** RAF / setInterval / setTimeout / AudioContextノード / MediaStream / ResizeObserver / addEventListener を全停止・解放する。リーク厳禁。

## ctx API（mount の第2引数）
- `ctx.sound.play(name)` — 効果音。name: `pop select tab back toggle move tick coin success win error lose hit whoosh`
- `ctx.sound.enabled` (getter) / `ctx.sound.toggle()`
- `ctx.audio()` — 共有 AudioContext（resume済み）。スタジオのドラム合成等に使う。
- `ctx.el(tag, attrs, ...children)` — DOMヘルパー。attrs: `class, html, text, style(obj), dataset(obj), on<Event>(fn), 真偽属性, 通常属性`。children は文字列/Node/配列可。
- `ctx.injectCSS(id, cssText)` — 冪等なstyle注入。**id は自分のモジュールid**にする（例 `'game-breakout'`）。CSSクラスは衝突回避のためモジュールidで接頭辞を付ける。
- `ctx.haptic(ms)` — `navigator.vibrate` ラッパ（Android のみ実機振動。iOSは無反応 → 触感は視覚の squish と効果音を主役に）。
- `ctx.storage(ns)` — `{ get(def), set(val) }`（JSON, `arcade:<ns>` で名前空間化）。**ns は自分のidで接頭辞**を付ける。
- `ctx.toast(msg, ms)` — 小さなトースト通知。
- `ctx.isTouch` — タッチ端末か。
- `ctx.fitCanvas(canvas, onResize)` — DPR補正付きの自動リサイズ。`onResize(fit)` が毎回呼ばれ、`fit.w/fit.h`(CSSピクセル) でレイアウト。**描画はCSSピクセル座標**でOK（2dコンテキストはDPRで事前スケール済み）。`unmount` で `fit.stop()` を呼ぶこと。

## レスポンシブ & タッチ必須事項
- PC（マウス/キーボード）・スマホ・タブレットすべてで快適に。**Pointer Events** を基本に。
- ゲームのcanvasは `touch-action: none` を設定し、操作中は `preventDefault()` でページのスクロール/ピンチズームを抑止。
- タップ対象は最小 44×44px。スマホ用に必要なら画面内ボタン（Dパッド等）を用意。
- `mount` のレイアウトは `root` 幅に追従（`.screen-content` は overflow:auto の flex column）。ゲームは `.playfield` ラッパ＋canvas＋`ctx.fitCanvas` 推奨。

## 使えるデザイントークン（base.css 由来）
CSS変数: `--red --orange --yellow --lime --green --teal --sky --blue --indigo --purple --pink`、
`--bg --bg-2 --surface --surface-2 --line --text --muted`、
`--r-tile --r-card --r-btn --r-pill --gap`、`--shadow --shadow-sm --shadow-lg`、`--spring`（ばね easing）。
共有クラス: `.btn .btn-primary .btn-accent .btn-green .btn-ghost .pill .icon-btn .card .field .mono .row .col .spacer .tag .muted .squish .playfield .pane`。

デザイン方針: 角丸・明るい原色・白基調・ぷにっとした手触り（`.squish` で押下スケール）・効果音。任天堂の商標/キャラ/固有UIは使わずオリジナルで。
