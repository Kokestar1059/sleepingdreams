/*
 * PWA アイコン生成スクリプト（モノトーン・引き算デザイン）
 *
 * 何のためのファイル？
 *   ホーム画面に追加したときに並ぶ「アプリの顔」を作る。
 *   下の SVG（1枚の原図）を sharp でラスタライズして、PWA に必要な
 *   PNG を一括出力する。デザインを直したくなったら SVG_SOURCE を編集して
 *   `node scripts/generate-icons.mjs` を実行し直せば全サイズが再生成される。
 *   （= 出力 PNG は手で描かず、この原図から常に作り直せる＝再現性がある）
 *
 * なぜ PNG が要るのか？（SVG だけではダメ？）
 *   - Lighthouse / インストール要件は 192・512 の PNG を求める
 *   - iOS の apple-touch-icon は PNG 前提
 *   なので「原図は SVG・配布は PNG」という二段構えにしている。
 *
 * デザイン方針（CLAUDE.md の原研哉トーン + Issue #15 のモノトーン指定）：
 *   - 近黒の背景に、オフホワイトの三日月＋小さな点ひとつ だけ。
 *   - 三日月 = 夜・睡眠・夢。点 = 漂う断片（メモ/気づき）。
 *     「夢も、気づきも」を最小の引き算で表す。
 *   - 全面ベタ塗り背景にしているのは maskable（OS が円や角丸に切り抜く）対応のため。
 *     模様を中央の安全圏（中心から半径 ~200px 以内）に収め、端を切られても欠けない。
 */

import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// このファイル自身の場所を基準に、プロジェクト直下の public/ を求める。
// （どこから実行しても出力先がブレないようにするため）
const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')

// 原図（512×512）。色は2色のみ＝モノトーン。
//   背景  : #0a0a0a（近黒）
//   図形  : #f5f5f4（オフホワイト）
// 三日月は「明るい円」から「背景色の円」をずらして重ね、上右側をくり抜いて作る。
// （背景がベタ塗りなので、背景色の円を上に置くだけで“削った”ように見える）
const SVG_SOURCE = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0a"/>
  <!-- 三日月：明るい円 → 背景色の円でくり抜き -->
  <circle cx="256" cy="262" r="120" fill="#f5f5f4"/>
  <circle cx="308" cy="226" r="110" fill="#0a0a0a"/>
  <!-- 漂う断片（小さな点）。三日月の開いた側に静かに浮かべる -->
  <circle cx="320" cy="170" r="15" fill="#f5f5f4"/>
</svg>
`

// 出力したい PNG の一覧。
//   - pwa-192 / pwa-512        : 通常アイコン（manifest の "any"）
//   - maskable-icon-512        : マスカブル（OS が形に合わせて切り抜く用）
//   - apple-touch-icon-180     : iOS ホーム画面用（PNG 必須・180px 推奨）
const OUTPUTS = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'maskable-icon-512x512.png', size: 512 },
  { file: 'apple-touch-icon-180x180.png', size: 180 },
]

// public/ が無ければ作る（通常は存在するが念のため）。
await mkdir(publicDir, { recursive: true })

const svgBuffer = Buffer.from(SVG_SOURCE)

// 各サイズへリサイズして PNG 書き出し。
// 原図が全面ベタ塗りなので、余白追加や背景合成は不要＝素直に縮小するだけ。
for (const { file, size } of OUTPUTS) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(publicDir, file))
  console.log(`generated: public/${file} (${size}x${size})`)
}

console.log('done.')
