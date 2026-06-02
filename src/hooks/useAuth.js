/*
 * useAuth.js — 認証状態（ログイン中のユーザー）を React に橋渡しするカスタムフック
 *
 * ■ このフックがやること
 *   - アプリ起動時に「今ログインしているか？」を Supabase に問い合わせる（getSession）
 *   - その後の状態変化（ログイン / ログアウト / トークン更新）を監視する（onAuthStateChange）
 *   - Google でログインする関数 / ログアウトする関数を提供する
 *   これらをまとめて返すことで、UI 側は「session があるか / loading 中か」を見るだけで済む。
 *
 * ■ なぜ Context ではなくフックにするか（学習メモ）
 *   このアプリで session を必要とするのは App ルートとヘッダーだけ。
 *   App で 1 回だけ useAuth() を呼び、必要な値を props で下に渡せば足りる。
 *   onAuthStateChange の購読も「1 箇所でだけ呼ぶ」ことで二重購読を避けられる。
 *   将来コンポーネントが増えて prop バケツリレーが辛くなったら Context 化すればよい（YAGNI）。
 *
 * ■ session と user の違い
 *   - session … アクセストークン等を含む「ログイン状態そのもの」。null ならログアウト中。
 *   - user    … session.user の取り出し。表示用（メールアドレス等）に使う。
 *   どちらも onAuthStateChange のコールバックが渡してくれる session から導出する。
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuth() {
  // 現在のログインセッション。null = 未ログイン。
  // 初期値 null だが、これが「未ログイン確定」を意味しないことに注意（下の loading で区別する）。
  const [session, setSession] = useState(null)

  // 初回の getSession が終わるまでは「ログイン状態が不明」。
  // この間にログイン画面を出すと、実はログイン済みのユーザーに一瞬ログイン画面が
  // チラつく（フラッシュする）。それを防ぐため loading=true の間は判定を保留する。
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // --- 1) アプリ起動直後の現在のセッションを取得 ---
    // ページをリロードしても、Supabase は前回のセッションを localStorage に保存しているので
    // getSession() で復元できる（＝ログインしっぱなしにできる）。
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      // セッションの有無が確定したのでローディング解除。
      setLoading(false)
    })

    // --- 2) その後の認証状態の変化を購読 ---
    // ログイン完了（OAuth リダイレクト後）・ログアウト・トークン自動更新などが起きるたびに
    // このコールバックが呼ばれ、最新の session を React state に反映する。
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      // onAuthStateChange は起動直後にも一度発火するので、ここでも loading を確実に解除しておく。
      setLoading(false)
    })

    // --- 3) アンマウント時に購読を解除（リーク防止） ---
    // StrictMode の開発時は effect が 2 回走るため、解除を忘れると購読が二重になる。
    return () => subscription.unsubscribe()
  }, []) // 空配列 = マウント時に 1 回だけ購読をセットアップする

  /*
   * Google でログイン。
   * signInWithOAuth を呼ぶとブラウザが Google の同意画面へリダイレクトし、
   * 認証後 redirectTo の URL（= このアプリ）へ戻ってくる。
   * 戻ってきた時に上の onAuthStateChange が発火して session が入る。
   *
   * redirectTo に現在のオリジン + Vite の BASE_URL を渡す理由:
   *   ローカル開発は http://localhost:5173/sleepingdreams/、
   *   本番(GitHub Pages)は https://<user>.github.io/sleepingdreams/ と
   *   配信元が変わる。両方で正しく戻れるよう、実行中の URL から組み立てる。
   *   （この URL は Supabase ダッシュボードの「Redirect URLs」に登録が必要）
   */
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      },
    })
    // リダイレクトが始まるので通常ここから先は実行されないが、
    // 設定ミス等で失敗した時に気づけるようにエラーを返す。
    if (error) {
      console.error('[auth] Google ログインに失敗しました:', error.message)
      throw error
    }
  }

  /*
   * ログアウト。
   * Supabase 側のセッションと localStorage のトークンを破棄する。
   * 破棄が完了すると onAuthStateChange が session=null で発火し、画面がログイン画面に戻る。
   */
  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[auth] ログアウトに失敗しました:', error.message)
      throw error
    }
  }

  return {
    session,
    user: session?.user ?? null, // 表示用に user を取り出しておく（未ログインなら null）
    loading,
    signInWithGoogle,
    signOut,
  }
}
