/*
 * アプリのルートコンポーネント。
 *
 * 役割:
 *   - AppHeader（FloatNote のワードマーク）を画面最上部に置く
 *   - Calendar コンポーネントを画面に置く
 *   - 全体の背景・文字色などのベースレイアウトを与える
 *
 * 学習メモ:
 *   - App.jsx は「画面の骨組み」だけを持ち、機能の中身は配下のコンポーネントに任せる。
 *     こうしておくと、後から Header / Footer / 設定画面などを足しやすい。
 *   - AppHeader を Calendar の外に置いた理由：
 *     アプリ名は「今どの月を見ているか」という状態と無関係。
 *     状態に依存しない表示要素は、状態を持つコンポーネントの外側に出すのが
 *     React の基本的な関心の分離パターン。
 */

import AppHeader from './components/AppHeader'
import Calendar from './components/Calendar'

function App() {
  return (
    // 画面全体のラッパー。
    //   min-h-screen : ビューポートの高さを最低限確保
    //   bg-gray-50   : ほぼ白の背景（CLAUDE.md の方針）
    //   text-gray-900: 本文テキストはダークグレーで目に優しく
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/*
        アプリ名ワードマーク。Calendar の外側（上位）に置くことで
        「月が変わってもアプリ名は変わらない」という関心の分離を構造で表す。
      */}
      <AppHeader />
      <Calendar />
    </div>
  )
}

export default App
