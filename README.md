# ①課題名
FloatNote（フロートノート）— 夢日記＋メモアプリ

## ②課題内容（どんな作品か）
- 夢・アイデア・日々の気づきを、カレンダーに記録できるメモアプリ
- 朝起きた直後や夜中に、ベッドで片手スマホ操作することを想定（モバイルファースト）
- 1日に複数のメモを記録でき、記録のある日にはドットが付く

## ③アプリのデプロイURL
- 課題提出用（GitHub Pages・静的・AI なし）: https://kokestar1059.github.io/sleepingdreams/
- 実用（Vercel・将来の AI 機能用）: Vercel 連携後に発行される URL（`https://<project>.vercel.app`）

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
- なし（ログイン不要・データはブラウザの localStorage に保存）

## ⑤工夫した点・こだわった点
- ミニマルなUI
- 「寝起き・暗い部屋・片手」でも迷わず使える操作性（大きめタップ領域・控えめなアニメ）
- 日付はタイムゾーンずれを避けるため文字列 `YYYY-MM-DD` で統一

## ⑥難しかった点・次回トライしたいこと（又は機能）
- React 初学習（useState / useEffect / カスタムフックの考え方）
- データのクラウド保存（Supabase 連携）と音声入力を次回トライしたい
- コードとコメントの整合を保ち続けること

## ⑦フリー項目（感想、シェアしたいこと等なんでも）
- [感想] 機能を作るだけでなく、デザインとコードレビューの工程を分けて回すことで、毎日使いたくなる仕上がりを目指せた。
- [参考記事]
  - 1. https://ja.react.dev/
  - 2. https://tailwindcss.com/docs
