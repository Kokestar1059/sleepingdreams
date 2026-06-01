// Vite の設定ファイル。
// defineConfig は型補完のために使うヘルパー（TS でなくても恩恵あり）。
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  base: '/sleepingdreams/',
  plugins: [react(), tailwindcss()],
})
