# ①課題名
FloatNote（フロートノート）— 夢日記＋メモアプリ

## ②課題内容（どんな作品か）
- 夢・アイデア・日々の気づきを、カレンダーに記録できるメモアプリ
- 朝起きた直後や夜中に、ベッドで片手スマホ操作することを想定（モバイルファースト）
- 1日に複数のメモを記録でき、記録のある日にはドットが付く
- 手入力に加え、**音声入力**でも記録できる（寝ぼけた状態でも喋るだけで残せる）

## ③アプリのデプロイURL
- 課題提出用（GitHub Pages・静的・AI なし）: https://kokestar1059.github.io/sleepingdreams/
- 実用（Vercel・将来の AI 機能用）: https://sleepingdreams.vercel.app/

### デプロイ構成（2 系統の住み分け）
同じ `main` ブランチを **GitHub Pages** と **Vercel** がそれぞれ独立に監視する別パイプラインで、共存して動く。

| 系統 | 役割 | base | サーバー処理 | 鍵の置き場所 |
|------|------|------|------------|------------|
| GitHub Pages | 課題提出用・静的・**AI なし** | `/sleepingdreams/` | 不可 | GitHub Secrets |
| Vercel | 実用・将来の AI 用 | `/`（ルート） | 可（`/api`・Phase 3） | Vercel 環境変数 |

- `vite.config.js` の `base` を `process.env.VERCEL ? '/' : '/sleepingdreams/'` で出し分ける（Vercel はビルド時に `VERCEL=1` を自動セット）。
- AI 要約（OpenAI）は Secret key をフロントに出せないため、サーバー処理を持てる **Vercel 側のみ**に Phase 3 で載せる。GitHub Pages 版は静的のまま AI を含めない。
- 詳細な判断の経緯は [docs/decisions/0002-deploy-two-track-pages-vercel.md](docs/decisions/0002-deploy-two-track-pages-vercel.md) を参照。

## ④アプリのログイン用IDまたはPassword（ある場合）
- **Google アカウントでログイン**（Supabase Auth の Google OAuth）。固定の ID/Password は無し。
- 現在 Google の OAuth 同意画面が「テスト」公開ステータスのため、**ログインできるのは
  テストユーザーに登録済みのアカウント（製作者本人とパートナー）のみ**。それ以外の Google
  アカウントは Google 側でブロックされる。
- **採点等で動作確認が必要な場合は、確認に使う Google アカウントのメールアドレスをお知らせ
  ください**（テストユーザーに追加します）。
- 各アカウントは自分のデータだけが見える（Supabase の Row Level Security で完全分離）。
  データはブラウザ内ではなく **Supabase（クラウド）に保存**され、複数端末で同期される。

## ⑤工夫した点・こだわった点
- 原研哉的なミニマルUI（白・余白・引き算）。「寝起き・暗い部屋・片手」でも迷わない操作性（大きめタップ領域・控えめなアニメ）
- **音声入力（Web Speech API）**：カレンダー下のマイクをタップすると今日のメモが開いてその場で録音開始。2 秒の無音で自動停止。途中で切れない・寝ぼけても使える調整にこだわった
- **PWA 対応**：ホーム画面に追加して全画面・高速起動（ベッドで開く前提）
- **Supabase + RLS** で自分とパートナーのデータを完全分離
- 日付はタイムゾーンずれを避けるため文字列 `YYYY-MM-DD` で統一

## ⑥難しかった点・次回トライしたいこと（又は機能）
- React 初学習（useState / useEffect / カスタムフックの考え方）
- **iPhone Safari の音声認識の癖**：途中経過が不安定、StrictMode で自動開始が空振りする等、
  実機でしか出ない挙動の切り分けと対処（無音タイマー・ワンショット自動開始など）
- 次回トライ：**AI でメモを軽く整形**（OpenAI を Vercel の API 経由で呼び鍵を保護）／
  **キーワード検索**／**ダークモード**
- コードとコメントの整合を保ち続けること

## ⑦フリー項目（感想、シェアしたいこと等なんでも）
- [感想] 機能を作るだけでなく、デザインとコードレビューの工程を分けて回すことで、毎日使いたくなる仕上がりを目指せた。
- [参考記事]
  - 1. https://ja.react.dev/
  - 2. https://tailwindcss.com/docs
