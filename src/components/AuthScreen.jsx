/*
 * AuthScreen コンポーネント — 未ログイン時に表示するログイン画面
 *
 * 役割:
 *   - アプリの顔（FloatNote）と、ひとことの説明を静かに置く
 *   - 「Google でログイン」ボタンを 1 つだけ提示する
 *
 * 設計のポイント（学習メモ）:
 *
 * 1) プレゼンテーショナル + 1 つのコールバック
 *    このコンポーネント自身は認証ロジックを持たない。
 *    「押されたら呼んでほしい関数」(onSignIn) を props で受け取るだけ。
 *    ロジック（useAuth）と見た目（AuthScreen）を分けると、
 *    どちらも単独で理解・差し替えしやすくなる（関心の分離）。
 *
 * 2) 押下中（リダイレクト待ち）の状態を自前で持つ
 *    OAuth はボタンを押すと Google へ画面遷移する。遷移までのわずかな間に
 *    二度押しされると同意フローが二重に走りうるので、submitting フラグで
 *    ボタンを無効化し「移動中…」を示す。
 *
 * 3) デザイン方針（原研哉トーン）
 *    画面中央に最小限の要素だけを置き、余白で「静けさ」を作る。
 *    色はモノトーン。唯一の操作（ログイン）に視線が自然に向かう構図にする。
 */

import { useState } from 'react'

function AuthScreen({ onSignIn }) {
  // ボタンを押してから Google へ遷移するまでの「処理中」状態。
  // useState の初期値 false = まだ押されていない。
  const [submitting, setSubmitting] = useState(false)

  const handleClick = async () => {
    // 二度押し防止：すでに処理中なら何もしない。
    if (submitting) return
    setSubmitting(true)
    try {
      // 親(App)から渡された signInWithGoogle を実行。
      // 成功すると Google へリダイレクトするので、この後の行は通常実行されない。
      await onSignIn()
    } catch {
      // 設定ミス等でリダイレクトに失敗した場合だけここに来る。
      // ボタンを押せる状態に戻して、ユーザーが再試行できるようにする。
      setSubmitting(false)
    }
  }

  return (
    // 画面いっぱいの縦中央寄せ。min-h-screen で高さを確保し、flex で上下中央に。
    <div className="flex min-h-screen flex-col items-center justify-center px-8">
      {/* アプリ名ワードマーク。AppHeader と字形トーンを合わせ、ここでは少し大きく主役に。 */}
      <div aria-label="フロートノート" role="img">
        <span className="text-base font-light tracking-[0.3em] text-gray-900">
          フロートノート
        </span>
      </div>

      {/*
       * ひとことの説明。
       * leading-relaxed で行間をゆったり取り、tracking-wide で字間に呼吸を持たせる。
       * 「夢・アイデア・気づき」を拾うアプリだと一行で伝える（用途拡大を反映）。
       */}
      <p className="mt-4 text-center text-xs font-light leading-relaxed tracking-wide text-gray-400">
        浮かぶ断片を、そっと書き留める。
      </p>

      {/*
       * ログインボタン。
       *   - min-h-[44px] : iOS HIG のタップターゲット最小サイズを満たす
       *   - 余白多めの mt-12 でワードマークと十分に間を取り、操作要素を独立させる
       *   - disabled 時は opacity を落とし、カーソルも変えて「今は押せない」を視覚化
       */}
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="mt-12 flex min-h-[44px] w-full max-w-xs items-center
                   justify-center gap-2 rounded-full border border-gray-300
                   bg-white px-6 text-sm font-light tracking-wide text-gray-900
                   transition-colors hover:bg-gray-50 active:bg-gray-100
                   disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Google へ移動中…' : 'Google でログイン'}
      </button>

      {/*
       * 補足の注意書き。各自のアカウントでデータが分離されることを静かに伝える。
       * 主役（ボタン）より一段薄い text-gray-300 で、読みたい人だけ読める存在感に。
       */}
      <p className="mt-8 text-center text-[11px] font-light leading-relaxed text-gray-300">
        ログインすると、あなたのアカウントだけに
        <br />
        記録が保存されます。
      </p>
    </div>
  )
}

export default AuthScreen
