# Google OAuth ログイン セットアップ手順（#11）

FloatNote の認証は **Supabase Auth + Google OAuth**。
コード側（`useAuth` / `AuthScreen` / 認証ゲート）は実装済みなので、
ここではあなたが **一度だけ手動で行う外部設定**をまとめる。
3 つの場所をこの順で設定する：**① Google Cloud → ② Supabase → ③ ローカル `.env.local`**。

> 用語: 接続に使うのは Supabase の **Publishable key**（`sb_publishable_...`）。
> ブラウザに露出してよいキー。秘匿で守るのではなく **RLS** で守る（entries は #12 で対応）。
> 対の **Secret key**（`sb_secret_...`）はサーバー専用。Git にもフロントにも絶対に出さない。

---

## ① Google Cloud Console（OAuth クライアントを作る）

1. <https://console.cloud.google.com/> でプロジェクトを作成（既存でも可）。
2. 「APIとサービス」→「OAuth 同意画面」を設定
   - User Type: **External**
   - アプリ名・サポートメール・デベロッパー連絡先を入力
   - テスト中は「テストユーザー」に**自分とパートナーのメールアドレスを追加**
     （公開申請しなくても、テストユーザーならログインできる）
3. 「認証情報」→「認証情報を作成」→「**OAuth クライアント ID**」
   - アプリケーションの種類: **ウェブアプリケーション**
   - **承認済みのリダイレクト URI** に、次の Supabase のコールバック URL を登録（②で URL を確定後に貼る）:
     ```
     https://<あなたのプロジェクトID>.supabase.co/auth/v1/callback
     ```
4. 作成後に表示される **クライアント ID** と **クライアントシークレット**を控える（②で使う）。

---

## ② Supabase ダッシュボード（Google プロバイダを有効化）

1. 対象プロジェクト →「Authentication」→「Sign In / Providers」→ **Google** を開く。
2. **Enable** をオンにし、①で控えた **Client ID** と **Client Secret** を貼る → Save。
3. このページ上部に表示される **Callback URL (for OAuth)** が
   `https://<プロジェクトID>.supabase.co/auth/v1/callback` であることを確認し、
   ①の「承認済みリダイレクト URI」に未登録なら登録する（①と②は相互参照）。
4. 「Authentication」→「URL Configuration」で **Redirect URLs** に
   アプリが戻ってくる URL を**両方**登録する（末尾スラッシュ込み・`base` と一致）:
   ```
   http://localhost:5173/sleepingdreams/
   https://<あなたのGitHubユーザー名>.github.io/sleepingdreams/
   ```
   > `useAuth` は `window.location.origin + import.meta.env.BASE_URL` を `redirectTo` に渡す。
   > `base: '/sleepingdreams/'`（vite.config.js）に合わせて末尾 `/sleepingdreams/` まで含める。

---

## ③ ローカルの `.env.local`（鍵をコードに渡す）

1. リポジトリ直下に `.env.local` を作成（`.gitignore` 済み。`.env.example` がテンプレート）。
2. Supabase「Project Settings」→「API Keys」から値を貼る:
   ```bash
   VITE_SUPABASE_URL=https://<プロジェクトID>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx...
   ```
3. `npm run dev` を**再起動**（Vite は起動時に env を読むため、既に起動中なら止めて再実行）。

---

## 動作確認チェックリスト

- [ ] `npm run dev` を開き、白画面でなく**ログイン画面**が出る
- [ ] 「Google でログイン」→ Google 同意画面 → アプリに戻り、**カレンダーが表示**される
- [ ] リロードしてもログイン状態が保持される（カレンダーのまま）
- [ ] ヘッダー右の「ログアウト」→ ログイン画面に戻る
- [ ] パートナーのアカウントでもログインできる（テストユーザー登録済みなら）

---

## GitHub Pages（本番）で有効化する場合（任意・後でも可）

Vite は `VITE_*` を**ビルド時に焼き込む**ため、Pages 版で Supabase を使うには
GitHub Actions の **Secrets** に 2 変数を登録し、build ステップに環境変数として注入する必要がある。
ローカルで動作確認できれば #11 の完了条件は満たすので、Pages 反映は #12 とまとめて対応してもよい。

> ⚠️ 注意: Pages で認証を有効にすると、公開 URL に誰でもアクセスできる以上
> 「Google でログイン」ボタンは見える。データ自体は RLS（#12）と「テストユーザー限定」で守る。
