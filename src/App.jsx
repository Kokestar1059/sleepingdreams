/*
 * アプリのルートコンポーネント。
 *
 * 役割（Issue #2 時点）:
 *   - Calendar コンポーネントを画面に置く
 *   - 全体の背景・文字色などのベースレイアウトを与える
 *
 * 学習メモ:
 *   - App.jsx は「画面の骨組み」だけを持ち、機能の中身は配下のコンポーネントに任せる。
 *     こうしておくと、後から Header / Footer / 設定画面などを足しやすい。
 */

import Calendar from './components/Calendar'

function App() {
  return (
    // 画面全体のラッパー。
    //   min-h-screen : ビューポートの高さを最低限確保
    //   bg-gray-50   : ほぼ白の背景（CLAUDE.md の方針）
    //   text-gray-900: 本文テキストはダークグレーで目に優しく
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Calendar />
    </div>
  )
}

export default App
