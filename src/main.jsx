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
//   新しいデプロイ＝新しい SW が見つかると、自動で新バージョンへ入れ替わる。
//   onNeedReload を渡さなければ、入れ替わり時に既定で window.location.reload() され、
//   次に開いたときには最新の画面になっている。
//   このアプリはデータを Supabase に都度保存しており、画面内に長時間の未保存状態を
//   抱えないので、自動リロードでも体験を壊しにくい（だから autoUpdate を採用）。
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
