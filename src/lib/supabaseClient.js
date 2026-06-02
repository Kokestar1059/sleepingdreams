/**
 * supabaseClient.js — Supabase クライアントの初期化（アプリ全体で 1 つだけ共有）
 *
 * ■ なぜこのファイルを分けるのか
 *   createClient() は「DB / 認証 / ストレージへの接続口」を 1 つ作る関数。
 *   コンポーネントごとに何度も作ると接続や認証状態が分裂してしまうので、
 *   ここで 1 回だけ作って export し、使う側は `import { supabase } from '...'` で共有する。
 *   （いわゆるシングルトン。React の文脈では「モジュールスコープの定数」で実現できる）
 *
 * ■ 環境変数の読み方（Vite 固有）
 *   Vite では環境変数を `import.meta.env.VITE_XXX` で読む（Node の process.env ではない）。
 *   かつ `VITE_` プレフィックスが付いた変数だけがフロントエンドのバンドルに露出する。
 *   - VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY … フロントで使う前提なので VITE_ を付ける
 *   - 逆に OpenAI のような秘密キーには VITE_ を付けない（付けるとブラウザに漏れる）
 *
 * ■ Publishable key は「公開されてよいキー」
 *   接続に使うのは Supabase の Publishable key（sb_publishable_...）。
 *   これは旧 anon key の後継で、ブラウザに露出する前提のキー。隠してもセキュリティにはならない。
 *   （旧 anon key（eyJ... の JWT）も動くが legacy 扱い。新規なので Publishable key を使う）
 *   「他人のデータを読み書きできないこと」は Supabase 側の RLS（Row Level Security）で守る。
 *   → entries テーブルを作るときに必ず RLS を有効化する（#12 で実施）。
 *   ⚠️ 対になる Secret key（sb_secret_...）はサーバー専用。フロント・Git に絶対出さない。
 */

import { createClient } from '@supabase/supabase-js'

// import.meta.env から接続情報を取り出す。
// 値は .env.local に書く（.gitignore 済みなのでコミットされない）。
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// 環境変数が未設定だと createClient が分かりにくいエラーを出すので、
// 先に分かりやすいメッセージで気づけるようにしておく（開発時の親切設計）。
if (!supabaseUrl || !supabasePublishableKey) {
  // throw せず warn に留めるのは、鍵未設定でもアプリ自体は起動させたいから
  // （Phase 1 の localStorage 機能はまだ動く状態を保ちたい）。
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY が未設定です。' +
      '.env.local を確認してください（.env.example がテンプレート）。'
  )
}

// アプリ全体で共有する単一のクライアント。
// auth オプションは Supabase のデフォルトに任せる（セッションを localStorage に保存し、
// トークンを自動更新する）。OAuth の細かい設定は認証実装（#11）で詰める。
export const supabase = createClient(supabaseUrl, supabasePublishableKey)
