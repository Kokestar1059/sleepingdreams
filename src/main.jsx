import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// vite-plugin-pwa が用意する“仮想モジュール”。実体のファイルは無く、
// ビルド時にプラグインが中身を差し込んでくれる（だから import 名がパスではなく virtual:〜）。
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Service Worker を登録する。
//
// なぜ App の描画より前に呼ぶか:
//   登録は副作用（ブラウザへの SW 登録依頼）であって React の描画とは独立。
//   早めに一度だけ呼んでおけば、以降の更新検知はプラグインが面倒を見てくれる。
//
// 更新フロー（registerType: 'autoUpdate' のとき）:
//   新しいデプロイ＝新しい SW が見つかると、自動で新バージョンへ入れ替わり、
//   既定で window.location.reload() されて最新の画面になる。
//
//   トレードオフ（正直に）:
//     エントリーは「保存ボタンを押した時」に Supabase へ書き込む方式なので、
//     入力途中は未保存。その自動リロードが“入力中”にちょうど重なると内容が消え得る。
//     ただし (1) 通常のブラウザ更新でも同じ既存挙動であること、
//          (2) デプロイは自分が行う前提で、誰かの入力中に重なる確率は低いこと
//     から、Issue #15 の方針どおり autoUpdate を採用している。
//     将来うるさく感じたら registerType:'prompt' にして「更新する？」トースト確認へ
//     切り替えられる（その場合 onNeedRefresh で UI を出す）。
registerSW({
  // 登録に失敗してもアプリ本体は動くべきなので、握りつぶさずログだけ残す。
  onRegisterError(error) {
    console.error('Service Worker の登録に失敗しました', error)
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
