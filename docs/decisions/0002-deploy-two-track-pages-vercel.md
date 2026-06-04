# ADR-0002: デプロイを GitHub Pages / Vercel の 2 系統で並行運用する

**ステータス**: Accepted
**日付**: 2026-06-04
**関連Issue**: #14
**関連ADR**: ADR-0001（Supabase 採用）

## 背景（Context）

これまで FloatNote は **GitHub Pages** のみにデプロイしてきた（課題提出用 URL）。
しかし今後を見据えると、Pages だけでは満たせない要件が出てくる。

- **Phase 3 で AI 要約（OpenAI）を入れたい**：OpenAI の Secret key はフロントに出せない。
  サーバー側（Serverless Function）で秘匿して呼ぶ必要があるが、GitHub Pages は
  **静的ホスティング専用でサーバー処理を持てない**。
- **一方で課題提出 URL は GitHub Pages 指定**で、ここは生かし続けたい。

「Pages を捨てて Vercel に一本化」も考えられるが、課題提出 URL を差し替える必要が出て
手間とリスクがある。逆に「Pages のまま AI を諦める」のは実用アプリとしての発展を止める。

## 決定（Decision）

**GitHub Pages と Vercel を、同じ `main` ブランチを各自が独立に監視する 2 系統で並行運用する。**

| 系統 | 役割 | base | サーバー処理 | 鍵管理 |
|------|------|------|------------|--------|
| GitHub Pages | 課題提出用・静的・AI なし | `/sleepingdreams/` | 不可 | GitHub Secrets（Actions ビルドで焼き込み） |
| Vercel | 実用・将来の AI 用 | `/`（ルート） | 可（`/api`・Phase 3） | Vercel 環境変数 |

- 両者は `main` をそれぞれ独立に監視する**別パイプライン**なので、片方が片方を壊さない。
- `vite.config.js` の `base` を `process.env.VERCEL ? '/' : '/sleepingdreams/'` で出し分ける。
  Vercel はビルド時に `VERCEL=1` を自動でセットするため、これだけで切り替わる。
- PWA の scope / start_url / Service Worker の参照パスは `BASE` 定数と
  `import.meta.env.BASE_URL` から導出済みなので、base 1 箇所の切替で全体が追従する。
- 今回（#14）のスコープは「Vercel で**基本機能**（ログイン / カレンダー / CRUD / PWA）が動く」まで。
  AI 機能は Phase 3 で Vercel 側にのみ載せる。

## 理由（Rationale）

- **課題提出 URL を温存できる**：Pages の `/sleepingdreams/` はそのまま。提出済みリンクを壊さない。
- **AI の置き場所を確保できる**：Vercel は Serverless Function を持てるので、Phase 3 で
  OpenAI Secret key をサーバー側に隠したまま `/api/summarize` 経由で呼べる（CLAUDE.md の方針どおり）。
- **切替コストがほぼゼロ**：コード側の地雷（base の散らばり・OAuth redirect の固定 URL）は
  #15 までの整理で既に解消済み。`redirectTo` は `window.location.origin + BASE_URL` と動的なので、
  オリジンが変わる Vercel でもコード修正なしで正しく戻ってくる。残るは `base` の 1 行だけ。
- **段階移行のための保険**：Vercel が実用に耐えると確認できるまで Pages を残せる。
  どちらかに問題が出てももう片方が生きている。

## 検討した代替案（Alternatives）

- **Vercel に一本化（Pages を廃止）**
  - 構成はシンプルになる。却下理由：課題提出 URL が Pages 指定で、差し替えの手間とリンク切れリスク。
    移行を急ぐ理由が無い（2 系統の維持コストは base 1 行と環境変数の二重登録のみで小さい）。
- **GitHub Pages のまま継続（AI を諦める / 別サービスで代替）**
  - 却下理由：Phase 3 の中心要件である AI 要約が、静的ホスティングでは Secret key を隠せず実現できない。
- **Cloudflare Pages / Netlify など他の Serverless 系**
  - いずれも AI 用サーバー処理は可能。却下理由：ADR-0001 で Supabase × Vercel の組み合わせ事例の
    豊富さ・鍵管理の作法の確立を評価済みで、新たに別サービスを学ぶ動機が薄い。

## 結果（Consequences）

**得られるもの**
- 課題提出用（Pages）と実用・AI 用（Vercel）を同時に保持できる。
- Phase 3 の AI 機能を載せる土台（サーバー処理を持てる環境）が整う。

**トレードオフ・新たに発生する責務**
- **環境変数の二重管理**：`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` を
  GitHub Secrets と Vercel 環境変数の**両方**に登録する。片方の更新漏れに注意。
- **Supabase の Redirect URLs 許可リスト登録が必須**：Authentication → URL Configuration に
  Vercel ドメインを追加しないと「Vercel だけログインできない」事故になる（コードではなく設定の漏れ）。
- **PWA は別オリジン＝別アプリ**：Pages 版（scope `/sleepingdreams/`）と Vercel 版（scope `/`）は
  別 PWA として扱われる。ホーム画面に 2 個入るのは想定どおりの挙動。
- **AI の出し分け責務（Phase 3）**：Pages は AI 無効を維持する必要がある。AI ボタンは
  `/api` が存在する環境でだけ機能するよう優雅に分岐させる設計が、Phase 3 で別途必要になる。
