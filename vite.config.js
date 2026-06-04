// Vite の設定ファイル。
// defineConfig は型補完のために使うヘルパー（TS でなくても恩恵あり）。
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// 公開パスの起点（base）をデプロイ先で出し分ける。
//   - GitHub Pages（課題提出用）: プロジェクトサイトは
//       https://<ユーザー名>.github.io/sleepingdreams/
//     というサブパス配信なので base は '/sleepingdreams/'。
//   - Vercel（実用・将来 AI 用）: 独自ドメインの直下＝ルート '/' で配信。
//
// Vercel はビルド時に環境変数 VERCEL=1 を自動でセットするので、それだけで判定できる
// （GitHub Actions 側には VERCEL が無いので、Pages ビルドは従来どおりサブパスのまま無傷）。
//
// この BASE 1 箇所を切り替えるだけで、下の manifest の scope / start_url も、
// src/sw.js が参照する import.meta.env.BASE_URL も丸ごと追従する設計にしてある
// （= PWA 全体が base に連動するので、デプロイ先ごとに散らばった修正が不要）。
const BASE = process.env.VERCEL ? '/' : '/sleepingdreams/'

// Tailwind CSS v4 は専用 Vite プラグインを使う方式に変わった。
// （v3 までの PostCSS / tailwind.config.js を使う方式は不要）
// プラグインを登録するだけで、`@import "tailwindcss";` を書いた CSS が処理される。
export default defineConfig({
  // GitHub Pages のプロジェクトサイトは
  //   https://<ユーザー名>.github.io/sleepingdreams/
  // というサブパスで配信される。
  // base を設定しないとビルド後の JS/CSS が "/" 起点の絶対パスになり、
  // サブパス配信時に 404 して画面が真っ白になる。リポジトリ名と一致させる。
  // （ローカルの `npm run dev` も http://localhost:5173/sleepingdreams/ で開く点に注意）
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),

    // ── PWA（ホーム画面に追加 → 全画面で起動できるようにする）───────────────
    // 今回のスコープは「インストール可能まで」。オフラインでのデータ閲覧・書き込み・
    // 認証キャッシュは“やらない”（古いデータ表示やログインループの事故を避けるため）。
    // つまり Service Worker は「アプリの外枠（JS/CSS/HTML/アイコン）だけ」をキャッシュし、
    // Supabase / Google への通信は一切キャッシュせず常にネットワークへ行かせる。
    VitePWA({
      // 'autoUpdate' … 新しいデプロイを検知したら自動で新 SW に入れ替える方式。
      // 下の main.jsx で registerSW を明示的に呼び、更新フローをコメント付きで管理する。
      registerType: 'autoUpdate',

      // injectManifest 方式を使う（自動生成の generateSW ではなく）。
      // 理由: このリポジトリの絶対パスに「'」(G's) が含まれ、generateSW が
      //   Workbox の場所を文字列として埋め込む際に壊れる。SW 本体は src/sw.js に
      //   自分で書き、ビルド時は precache 一覧（self.__WB_MANIFEST）だけ差し込む。
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',

      // 補足: includeAssets（public 配下の追加ファイルを precache に明示する逃げ道）は
      // 使っていない。favicon.svg / apple-touch-icon などは、下の
      // injectManifest.globPatterns（**/*.{svg,png,...}）がビルド出力をまとめて拾うため
      // 既に precache 済みで、明示は不要だから（書くと二重で紛らわしくなる）。

      // Web App Manifest（このオブジェクトから manifest.webmanifest が生成され、
      // <link rel="manifest"> も index.html に自動で差し込まれる）。
      manifest: {
        name: 'FloatNote',
        short_name: 'FloatNote',
        description: '夢も、気づきも。浮かぶ断片を書き留めるメモ。',
        lang: 'ja',
        // scope / start_url を base に一致させる。ここが '/' だと
        // GitHub Pages のサブパス配信で起動時に 404 する。
        scope: BASE,
        start_url: BASE,
        // standalone = ブラウザの URL バー等を消して“アプリ然”と全画面表示する。
        display: 'standalone',
        // 寝起き・片手操作が主用途なので縦固定にする（勝手に横回転させない）。
        orientation: 'portrait',
        // theme_color / background_color は OS のツールバーや起動スプラッシュに使われる色。
        // アプリ本体は白基調（gray-50）なので、ここも白に寄せて世界観を保つ。
        // （アイコンだけが近黒。スプラッシュまで黒にすると「白いアプリ」の印象が崩れる）
        theme_color: '#f9fafb',
        background_color: '#f9fafb',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // purpose: 'maskable' は OS が円・角丸などに切り抜く前提のアイコン。
          // これが無いと Android で白フチ付きの縮小アイコンになりがち。
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      // injectManifest 用の設定。
      //   precache する“アプリの外枠”だけをここで決める（データは含めない）。
      //   ＝ self.__WB_MANIFEST に展開され、src/sw.js の precacheAndRoute に渡る。
      //   navigateFallback や Supabase/Google を除外する denylist は generateSW 専用の
      //   オプションなので、ここではなく src/sw.js 側のコードで実装している。
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },

      // dev（npm run dev）では SW を無効にしておく（既定 false）。
      // 理由: dev で SW を動かすとキャッシュが絡み「直したのに反映されない」混乱が
      //   起きやすい。PWA / SW / インストール導線の動作確認は、実際の本番ビルドを
      //   配信する `npm run preview` で行うのが確実（dev は UI 開発に専念させる）。
      //   検証したいときだけ一時的に true にする。
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
