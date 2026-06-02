/*
 * Service Worker（自前で書く版）
 *
 * なぜ自前で書く？（vite-plugin-pwa の自動生成を使わない理由）
 *   このプロジェクトのフォルダパスに「'」(アポストロフィ, 例: G's) が含まれる。
 *   自動生成（generateSW）方式は、Workbox の置き場所を絶対パスの文字列として
 *   SW に埋め込むため、その「'」が文字列を途中で閉じてしまいビルドが壊れる。
 *   そこで injectManifest 方式に切り替え、SW 本体は人間が書き、ビルド時には
 *   「precache すべきファイル一覧」だけを self.__WB_MANIFEST に差し込んでもらう。
 *   こうすると絶対パスを埋め込む処理を通らないので、パスの「'」問題を回避できる。
 *
 * このファイルがやること（= 今回の PWA スコープ＝「インストール可能まで」）:
 *   1. アプリの外枠（JS/CSS/HTML/アイコン）だけを precache して、起動を速くする
 *   2. Supabase / Google への通信は一切キャッシュしない（常に最新・認証事故を防ぐ）
 *   3. 新しいデプロイが出たら速やかに新 SW へ入れ替える（autoUpdate と対になる挙動）
 */

import { clientsClaim } from 'workbox-core'
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

// --- 更新を即座に効かせる（autoUpdate 方式の前提）---
// skipWaiting: 新 SW を「待機」させずすぐ有効化する。
// clientsClaim: 既に開いているタブも新 SW の管理下に置く。
// この2つで「デプロイ → 次に開いたら最新」が成立する。
self.skipWaiting()
clientsClaim()

// 古い世代の precache を掃除して、ストレージが無限に膨らまないようにする。
cleanupOutdatedCaches()

// --- アプリの外枠を precache ---
// self.__WB_MANIFEST は injectManifest がビルド時に
// 「[{url, revision}, ...]（= 外枠ファイル一覧）」へ置き換えてくれるプレースホルダ。
// 中身は vite.config.js の workbox.globPatterns で決まる。
precacheAndRoute(self.__WB_MANIFEST)

// --- SPA 用のナビゲーション・フォールバック ---
// 未知のパスへ“画面遷移”したときは、precache 済みの index.html を返す。
// ただし下記 denylist に当たるものは対象外＝ネットワークへ素通しする：
//   - /auth/ … OAuth コールバック等
//   - supabase.co / accounts.google.com … 認証・データの本体（キャッシュ厳禁）
// これにより「常にサーバーへ取りに行く＝古いデータ・ログインループを起こさない」を担保する。
// base 配下の index を指すよう、絶対パスは /sleepingdreams/ 始まりにする。
const navigationHandler = createHandlerBoundToURL('/sleepingdreams/index.html')
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/auth\//, /supabase\.co/, /accounts\.google\.com/],
})
registerRoute(navigationRoute)
