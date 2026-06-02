/*
 * アプリのルートコンポーネント。
 *
 * 役割:
 *   - 認証状態（useAuth）を 1 箇所で管理し、ログイン状況に応じて画面を切り替える
 *       loading 中     → 何も出さない（チラつき防止）
 *       未ログイン     → AuthScreen（ログイン画面）
 *       ログイン済み   → AppHeader + Calendar（本体）
 *   - 全体の背景・文字色などのベースレイアウトを与える
 *
 * 学習メモ:
 *   - useAuth() は「このアプリで唯一」ここで呼ぶ。
 *     onAuthStateChange の購読を 1 箇所に集約し、二重購読を避けるため。
 *     下位コンポーネントが session を必要とする時は props で渡す（prop drilling）。
 *   - App.jsx は「画面の骨組み + 大きな分岐」だけを持ち、機能の中身は配下に任せる。
 */

import { useAuth } from './hooks/useAuth'
import AuthScreen from './components/AuthScreen'
import AppHeader from './components/AppHeader'
import Calendar from './components/Calendar'

function App() {
  // 認証状態を取得。session があればログイン済み、loading 中は判定保留。
  const { user, loading, signInWithGoogle, signOut } = useAuth()

  // --- 1) ログイン状態を確認している間 ---
  // getSession の結果が出るまでは未ログインか確定しない。
  // ここでログイン画面を出すと、ログイン済みユーザーに一瞬チラついてしまう。
  // 背景だけ出して中身は空にし、確定するのを待つ。
  if (loading) {
    return <div className="min-h-screen bg-gray-50" />
  }

  // --- 2) 未ログイン ---
  // user が null（= session なし）ならログイン画面だけを見せる。
  // 記録画面（Calendar）には到達させない＝データを完全に分離する入口。
  if (!user) {
    return (
      // pb-[env(safe-area-inset-bottom)]: standalone 起動時、画面最下部の
      // ホームインジケータ（iPhone の横バー）と中身が重ならないよう下に余白を確保する。
      <div className="min-h-screen bg-gray-50 text-gray-900 pb-[env(safe-area-inset-bottom)]">
        <AuthScreen onSignIn={signInWithGoogle} />
      </div>
    )
  }

  // --- 3) ログイン済み ---
  // 本体（ヘッダー + カレンダー）を表示する。
  // AppHeader にユーザー情報とログアウト関数を渡し、ヘッダー右側に出す。
  return (
    // pb-[env(safe-area-inset-bottom)]: 上のヘッダーで top のセーフエリアを吸収しているのと対に、
    // 最下部もホームインジケータ分の余白を足して、全画面起動でも端が隠れないようにする。
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-[env(safe-area-inset-bottom)]">
      <AppHeader user={user} onSignOut={signOut} />
      <Calendar />
    </div>
  )
}

export default App
