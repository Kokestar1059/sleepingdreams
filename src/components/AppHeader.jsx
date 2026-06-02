/*
 * AppHeader コンポーネント — FloatNote のワードマーク（アプリの顔）+ ログアウト
 *
 * 役割:
 *   - アプリ名「フロートノート」(FloatNote) を画面最上部に静かに置く
 *   - ログイン中のユーザー（メールアドレス）と「ログアウト」を右端に控えめに添える
 *
 * props:
 *   - user      … ログイン中のユーザー（Supabase の user オブジェクト）。表示用に email を使う
 *   - onSignOut … ログアウトを実行する関数（App から渡される。中身は useAuth の signOut）
 *
 * 設計のポイント（学習メモ）:
 *
 * 1) なぜ App.jsx に置くか（Calendar.jsx ではないか）
 *    アプリ名やログイン状態はカレンダーの状態（今どの月か）と無関係な情報。
 *    状態に依存しない／カレンダーより上位の関心は、Calendar の外側に出す。
 *
 * 2) ほぼプレゼンテーショナル
 *    自前の useState は持たず、props（user / onSignOut）を受け取って描くだけ。
 *    認証ロジックは useAuth に集約し、ここは「表示と、押されたら親の関数を呼ぶ」に徹する。
 *
 * 3) デザイン方針（原研哉トーン）
 *    重厚なロゴシンボル（SVG）は入れない。"FloatNote" という単語の字形自体が
 *    既にグラフィックとして十分。ログアウトも主張せず、薄いテキストリンク的に置く。
 */

function AppHeader({ user, onSignOut }) {
  return (
    /*
     * 外周：画面左右は Calendar の px-5 に揃える。上 pt-5 / 下 pb-3 + 下線で「章題」を仕切る。
     * flex + justify-between で「ワードマーク（左）」と「ログアウト（右）」を両端に置く。
     * items-center で両者の縦位置を中央に揃える。
     */
    <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-200">
      {/*
       * ワードマーク本体。
       * <h1> にしない理由：このアプリはカレンダーが主コンテンツ。
       * アプリ名は「見出し」ではなく「ロゴ（装飾的表示）」。
       * スクリーンリーダーには role="img" + aria-label で「フロートノートという印」と伝える。
       */}
      <div aria-label="フロートノート" role="img">
        <span className="text-sm font-light tracking-[0.2em] text-gray-900">
          フロートノート
        </span>
      </div>

      {/*
       * ログアウトボタン。
       *   - min-h-[44px] でタップ領域を確保しつつ、見た目は -mr-2 px-2 で右端に寄せて軽く見せる
       *   - title に user.email を入れ、ホバー時に「誰でログインしているか」を確認できる
       *     （画面上に常時メールを出すと長くて崩れやすいので、確認はホバー/読み上げに委ねる）
       *   - aria-label でスクリーンリーダーにもメールアドレス付きで意味を伝える
       */}
      <button
        type="button"
        onClick={onSignOut}
        title={user?.email ?? ''}
        aria-label={user?.email ? `${user.email} からログアウト` : 'ログアウト'}
        className="-mr-2 flex min-h-[44px] items-center px-2 text-xs font-light
                   tracking-wide text-gray-400 transition-colors
                   hover:text-gray-700 active:text-gray-900"
      >
        ログアウト
      </button>
    </div>
  )
}

export default AppHeader
