# CLAUDE.md — 夢日記アプリ (Dream Journal)

## プロジェクト概要

夢日記専用のWebアプリ。朝目覚めた直後（または夜中）に眠い目をこすりながら夢の内容を記録できる。
カレンダーUIで「いつ・どんな夢を見たか」を一目で把握できるシンプルな日記アプリ。

| 項目 | 内容 |
|------|------|
| 使用者 | 自分 + パートナー（各自のアカウントで完全に分離） |
| 主な目的 | 実際に使えるプロダクトを作る |
| 開発方針 | **MVP（最小限で動くもの）を最速で完成させる** |
| 使用シーン | 朝起きた直後・夜中、ベッドの中で片手スマホ操作 |

---

## 技術スタック

> ⚠️ **バージョンは context7 で最新版を確認してから採用すること**（後述の「ライブラリ利用時のルール」参照）

| 役割 | ライブラリ / サービス | 備考 |
|------|----------------------|------|
| UIフレームワーク | **React**（関数コンポーネント + Hooks） | 学習目的のため `JavaScript`(.jsx)。TypeScriptは使わない |
| スタイリング | **Tailwind CSS** | Vite公式プラグイン経由でセットアップ |
| ビルドツール | **Vite** | 高速・設定が少ない |
| データ保存（Phase 1） | **localStorage** | ブラウザ内のみ |
| データ保存（Phase 2） | **Supabase**（PostgreSQL） | 無料枠で十分 |
| 認証（Phase 2） | **Supabase Auth**（Google OAuth） | |
| AI要約（Phase 3） | **OpenAI GPT API** | Vercel Serverless Function 経由で呼ぶ |
| 音声入力（Phase 3） | Web Speech API | ブラウザ標準。Chrome/Edge推奨 |
| デプロイ（課題用） | **GitHub Pages** | AI機能なし・静的のみ |
| デプロイ（実用） | **Vercel** | AI機能あり・API Routesでキー保護 |

---

## 事前準備（環境構築）

### 必要なもの
- **Node.js**: v20 LTS 以上（`node -v` で確認）
- **npm**: Node.js に同梱
- **Git**: 既にインストール済み（前プロジェクト経験あり）
- **GitHubアカウント**: デプロイ用
- （Phase 2以降）**Supabaseアカウント** + **Vercelアカウント** + **OpenAI APIキー**

### 初回セットアップコマンド
```bash
# Vite + React プロジェクトを現ディレクトリに作成
npm create vite@latest . -- --template react

# 依存関係インストール
npm install

# Tailwind CSS セットアップ（最新版の手順は context7 で要確認）
# 開発サーバー起動
npm run dev
```

---

## 開発フェーズ

### Phase 1 — MVP（ローカル完結・最優先）
> localStorage のみ。ログイン不要。まず「動く夢日記」を完成させる。

**実装する機能：**
- [ ] カレンダーUI（月表示・スマホ最適化）
- [ ] 前月・翌月のナビゲーション
- [ ] 日付クリック → モーダルで**その日のエントリー一覧 + 「新規追加」ボタン**を表示
- [ ] エントリー作成・編集・削除（タイトル + 本文）
- [ ] **1日に複数エントリーを記録可能**（一晩で複数の夢を見たケース対応）
- [ ] 記録済みの日付にドット（●）をつける（エントリー数に応じて色を濃くするなどの拡張も可）
- [ ] **データのJSONエクスポート / インポート機能**（localStorageは消失リスクがあるためバックアップ手段を必ず用意）

**実装しない（後回し）：**
- ログイン・認証
- 検索機能
- AI・音声入力
- ダークモード

---

### Phase 2 — Supabase 連携
> データをクラウドに移行し、複数デバイス・複数ユーザーで使えるようにする。

**実装する機能：**
- [ ] Supabase プロジェクトのセットアップ
- [ ] Google OAuth ログイン（Supabase Auth）
- [ ] エントリーデータを Supabase の `entries` テーブルに保存
- [ ] Row Level Security（RLS）：自分のデータだけ読み書き可能にする
- [ ] localStorage → Supabase へのデータ移行ボタン（Phase1ユーザー向け）
- [ ] Vercel へのデプロイ（環境変数で APIキーを管理）

---

### Phase 3 — AI・音声機能
> 半分寝ながらでも記録できる体験を作る。

**実装する機能：**
- [ ] Web Speech API で音声入力（マイクボタン）
- [ ] OpenAI GPT API でテキストを自然な文章に整形
  - **方針：** 支離滅裂な入力を「過剰に解釈せず」軽く整理するだけ
  - ユーザーが話した内容の意味を変えない・新しい情報を補完しない
  - プロンプトには「原文の語彙を尊重し、文の繋ぎ・句読点・改行のみを整える」と明示
- [ ] Vercel API Routes（`/api/summarize`）経由で OpenAI を呼ぶ → APIキーをフロントに出さない
- [ ] 検索機能（タイトル・本文をキーワード検索）
- [ ] ダークモード切り替え

---

## ディレクトリ構成（目標）

```
sleepingdreams/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/          # 再利用できる UI コンポーネント（JSXファイル）
│   │   ├── Calendar.jsx     # カレンダー本体（月表示グリッド）
│   │   ├── CalendarDay.jsx  # 1日分のセル（ドット表示など）
│   │   ├── EntryModal.jsx   # 記録用モーダル
│   │   └── Header.jsx       # 月ナビゲーション（< 2026年5月 >）
│   ├── hooks/               # カスタム React Hooks
│   │   └── useEntries.js    # エントリーの CRUD ロジック（localStorage）
│   ├── utils/               # 純粋な計算・変換関数
│   │   ├── dateUtils.js     # カレンダー生成・日付フォーマット
│   │   └── storage.js       # localStorage のラッパー + JSONエクスポート
│   ├── App.jsx              # アプリのルートコンポーネント
│   ├── main.jsx             # React の起動ポイント
│   └── index.css            # Tailwind の設定
├── api/                     # Vercel Serverless Functions（Phase 3）
│   └── summarize.js         # OpenAI 呼び出しエンドポイント
├── .env.local               # ローカルの環境変数（Git に上げない！）
├── .env.example             # 環境変数のサンプル（こちらはGit管理OK）
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js       # （Tailwind v3使用時のみ）
├── vite.config.js
└── CLAUDE.md                # このファイル
```

---

## データモデル

### エントリー（1件の夢日記）

```js
// localStorage のキー: "dream_entries"（全エントリーを配列で保持）
[
  {
    id: "01h8x9k2m3n4p5q6r7s8t9u0",  // 一意ID（UUID または crypto.randomUUID()）
    entryDate: "2026-05-26",         // この夢が属する日付（YYYY-MM-DD）
    title: "空を飛ぶ夢",             // タイトル（任意）
    body: "青い空を...",             // 本文（プレーンテキスト・改行OK）
    createdAt: "2026-05-26T06:30:00.000Z",
    updatedAt: "2026-05-26T06:35:00.000Z"
  },
  {
    id: "01h8x9k2m3n4p5q6r7s8t9u1",
    entryDate: "2026-05-26",         // 同じ日付でも別エントリーとして扱える
    title: "落下する夢",
    body: "次に見た夢では...",
    createdAt: "2026-05-26T06:40:00.000Z",
    updatedAt: "2026-05-26T06:40:00.000Z"
  }
]
```

### 設計のポイント（1日複数エントリー対応）
- **id は日付ではなくUUID**にして、1日に何件でも記録できるようにする
- 日付検索は `entries.filter(e => e.entryDate === "2026-05-26")` で行う
- カレンダーのドット表示は「その日にエントリーが1件以上あるか」で判定
- モーダルを開いたら**まずその日のエントリー一覧を表示**し、選択 or 新規作成へ遷移

### 日付の扱いルール
- **エントリーの日付 = ユーザーがカレンダーで選んだ日付**（システム時刻ではなく明示選択）
- 例：深夜2時に見た夢を記録する場合、ユーザーは「昨日」のセルをクリックして記録できる
- タイムゾーンは**ブラウザのローカルタイムゾーン**を採用（日本前提）
- 内部での比較は文字列 `"YYYY-MM-DD"` 形式で行い、Dateオブジェクトでの比較は避ける（タイムゾーンずれ防止）

### Phase 2 移行の見通し
Supabase の `entries` テーブルに以下のカラムでマッピングする：
- `id` (uuid, primary key) ← localStorage の `id` をそのまま使える
- `user_id` (uuid, foreign key → auth.users) ← 新規追加
- `entry_date` (date) ← `entryDate`
- `title` (text)
- `body` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

---

## UI・デザイン方針

| 項目 | 方針 |
|------|------|
| **設計優先度** | **モバイルファースト**（ベッドで片手スマホ操作が主用途） |
| **カラーパレット** | ミニマル・モノトーン（白・グレー・黒） |
| **言語** | 日本語 UI |
| **フォント** | システムフォント（余計な依存を増やさない） |
| **アニメーション** | 最小限。モーダルのフェード程度 |
| **タップターゲット** | 最低44×44px（iOS HIGガイドライン） |
| **メインカラー** | `gray-900`（文字）/ `gray-50`（背景）/ `gray-300`（ボーダー） |
| **アクセントカラー** | `gray-800` or `black`（ボタン・ドット） |
| **モーダル** | 画面中央に浮かぶカード形式。背景は半透明スクリム + `backdrop-blur` でブラー |

---

## ライブラリ利用時のルール（context7）

**🔴 重要：** ライブラリのコードを書く前に、必ず `context7` で最新の公式ドキュメントを参照すること。

### 理由
- React は v18 → v19 で API が変化（`use` フック、Actions、`useFormStatus` など）
- Tailwind CSS は v3 → v4 で設定方法が大幅変更（PostCSS → 専用Viteプラグイン）
- Supabase SDK・OpenAI SDK は頻繁に更新される
- AIが学習時点の古い書き方を提案するリスクを避けるため

### 利用タイミング
- 新しいライブラリを導入するとき
- ライブラリの API（フック・関数）を初めて使うとき
- エラーが出て解決策がわからないとき
- 「これって最新の書き方？」と少しでも迷ったとき

### 使い方の例
```
プロンプト例：
「Tailwind CSS v4 を Vite + React にセットアップする手順を context7 で調べて教えて」
「Supabase Auth で Google OAuth を実装する最新の書き方を context7 で確認して」
「React 19 の useActionState の使い方を context7 で見て」
```

---

## APIキー・セキュリティ方針

```
【絶対に守ること】
.env.local を Git に上げない（.gitignore に必ず含める）
APIキーをソースコードに直接書かない

【GitHub Pages 版（課題用）】
→ 静的ファイルのみ。APIキー不要。AI機能は含めない。
→ Phase 1 + Phase 2の基本機能までを公開対象とする。

【Vercel 版（実用）】
→ Vercel ダッシュボードの「Environment Variables」で設定する。
→ フロントエンドから OpenAI を直接呼ばない。
→ 必ず /api/summarize （Vercel Serverless Function）を経由させる。
```

### `.env.example` のサンプル（Git管理OK）
```bash
# Supabase（Phase 2 以降）
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxx...

# OpenAI（Phase 3 以降・Vercel Serverless Functionsでのみ使用）
# VITE_プレフィックスをつけないこと！（フロントに露出する）
OPENAI_API_KEY=sk-xxxxx...
```

---

## コーディング規約

### React の書き方
- **関数コンポーネントのみ**（class component は使わない）
- **Hooks を積極的に使う**（useState, useEffect, カスタムHook）
- Props は**分割代入**で受け取る: `function Card({ title, date }) {}`
- ファイル名は **PascalCase**（例：`EntryModal.jsx`）
- イミュータブルに状態を更新（`setState(prev => [...prev, newItem])`）

### コメントについて
> このプロジェクトは React 学習を兼ねているため、**初見でも意図がわかるコメントを詳しく書く**。
> - **なぜこう書くのか**（設計意図）を説明する
> - React 固有の概念（useState の挙動など）は特に丁寧に
> - 「何をしているか」だけでなく「どう動くか」も書く

```jsx
// 良いコメントの例：
// useState で "現在表示している月" を管理する。
// 初期値は今月（new Date() で取得）。
// setCurrentMonth を呼ぶたびに React が再レンダリングし、
// カレンダーが自動で更新される仕組み。
const [currentMonth, setCurrentMonth] = useState(new Date());
```

### スタイリング
- **Tailwind CSS のユーティリティクラスのみ**（別途 CSS ファイルに書かない）
- クラスが長くなる場合は改行して整理する
- 共通スタイルは Tailwind の `@apply` ではなく React コンポーネントで再利用する

---

## 変更管理ルール

仕様変更・機能追加・方向転換が起きたときの対応方針。

### 変更の規模で対応を変える（3段階）

| 規模 | 例 | やること |
|------|-----|---------|
| **小** | 機能追加・バグ修正・UI微調整 | Issue + CLAUDE.md更新 + コミット（`Closes #N`） |
| **中** | 機能の仕様変更・ライブラリ差し替え | 上記 + 詳しいコミットメッセージ（理由・影響を明記） |
| **大** | 設計の根本変更・技術選定 | 上記 + ADR を `docs/decisions/` に作成 |

### 履歴の住み分け

| 情報 | 保管場所 |
|------|---------|
| **WHAT・WHEN**（何がいつ変わったか） | Git log / diff（自動） |
| **WHY**（なぜ変えたか・小〜中規模） | Issue / コミットメッセージ |
| **重大な決断の経緯** | ADR ファイル（`docs/decisions/`） |
| **現在の状態** | CLAUDE.md（過去の状態は書かない・Git に任せる） |

### CLAUDE.md 更新の原則
- 「現在こうなっている」だけ書く。**過去の方針は残さない**
- 過去のバージョンが必要なら `git log -p CLAUDE.md` で見る
- 「なぜ変えたか」は Issue / コミットメッセージ / ADR に書く

### コミットメッセージのスタイル（中規模以上）
```
<type>: 一行サマリ (#Issue番号)

理由:
- 箇条書きで背景・動機を説明

影響:
- 何が変わったか（ファイル・挙動・他機能への波及）
```
type の例: `feat`（新機能）, `fix`（バグ修正）, `refactor`, `docs`, `decision`（ADR採用時）

### ADR（Architecture Decision Record）

#### 導入タイミング
- **Phase 1（現在）**: まだ ADR は不要
- **Phase 2 開始時**: Supabase 採用の ADR を初回として作成
- **以降**: 大きな方針転換のたびに追加

#### 作成場所
`docs/decisions/NNNN-kebab-case-title.md`（例：`0001-database-supabase.md`）

#### ADR テンプレート
```markdown
# ADR-NNNN: タイトル

**ステータス**: Proposed / Accepted / Superseded by ADR-XXXX
**日付**: YYYY-MM-DD
**関連Issue**: #N

## 背景（Context）
解決したい問題・状況を説明

## 決定（Decision）
何を採用するか

## 理由（Rationale）
なぜそれを選んだか

## 検討した代替案（Alternatives）
他に検討した選択肢と、なぜ却下したか

## 結果（Consequences）
それによって得られるもの・トレードオフ
```

#### ADR を書くべきタイミング
- ✅ 技術スタックを選定したとき（DB, 認証, 主要ライブラリなど）
- ✅ アーキテクチャの方向性を変えたとき
- ✅ 「1年後の自分が『なんでこの選択した？』と聞くと困る」決断
- ❌ 機能追加（Issue で十分）・バグ修正・UI 調整

---

## よく使うコマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド（本番用）
npm run build

# ビルド結果のプレビュー
npm run preview

# GitHub Pages へのデプロイ（vite.config.js に base を設定すること）
# 例: base: '/sleepingdreams/'
npm run build && npx gh-pages -d dist

# Vercel へのデプロイ（初回のみ vercel CLI で連携、以降は git push で自動）
git push origin main
```

---

## 重要な注意事項

1. **新しいライブラリを使う前に必ず context7 で最新版を確認**（最重要）
2. **1日複数エントリー対応**：`id` は日付ではなくUUIDを使い、`entryDate` フィールドで日付を持つ
3. **Phase 1 は localStorage のみ**：Supabase の接続を先に試みない
4. **localStorageのデータ消失対策**：必ずJSONエクスポート機能を入れる
5. **AI 要約は「軽く整理するだけ」**：ユーザーの意図を勝手に解釈・補完しない
6. **コードに APIキーをハードコードしない**：必ず環境変数を使う
7. **GitHub Pages 版には AI 機能を含めない**：静的ホスティングには秘密情報を載せられない
8. **タイムゾーン処理は文字列 `YYYY-MM-DD` で統一**：Dateオブジェクト比較は避ける

---

## 参考リンク

> 実装時は context7 経由で最新の公式ドキュメントを参照する。下記はあくまで入り口。

- [React 公式ドキュメント（日本語）](https://ja.react.dev/)
- [Tailwind CSS ドキュメント](https://tailwindcss.com/docs)
- [Vite ドキュメント](https://ja.vitejs.dev/)
- [Supabase ドキュメント](https://supabase.com/docs)
- [OpenAI API ドキュメント](https://platform.openai.com/docs)
- [Vercel ドキュメント](https://vercel.com/docs)
