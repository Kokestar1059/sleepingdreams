// Vite の設定ファイル。
// defineConfig は型補完のために使うヘルパー（TS でなくても恩恵あり）。
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tailwind CSS v4 は専用 Vite プラグインを使う方式に変わった。
// （v3 までの PostCSS / tailwind.config.js を使う方式は不要）
// プラグインを登録するだけで、`@import "tailwindcss";` を書いた CSS が処理される。
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
