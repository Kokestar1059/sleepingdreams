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
// 中身は vite.config.js の injectManifest.globPatterns で決まる。
precacheAndRoute(self.__WB_MANIFEST)

// --- SPA 用のナビゲーション・フォールバック ---
// 未知のパスへ“画面遷移”したときは、precache 済みの index.html を返す。
// （このアプリは実質 1 ページなので主に保険。start_url 自体も precache 済み）
//
// 返す index のパスは import.meta.env.BASE_URL（= vite.config.js の base、
// ビルド時に '/sleepingdreams/' へ静的置換される）から組み立てる。
// こうすると base を変えても SW 側を直さずに済む（パスのハードコードを避ける）。
//
// なぜ Supabase / Google を除外する denylist を書かないか:
//   そもそもこの NavigationRoute に “データ通信” は到達しないため、書いても無意味。
//   - NavigationRoute は mode:'navigate'（=ブラウザのページ遷移）にだけ反応する。
//     Supabase へのデータ API は fetch(mode:'cors') なので対象外＝素通り＝キャッシュされない。
//   - Google ログインへのリダイレクトは別オリジン。precache に無いので SW は何もしない。
//   ＝「アプリシェルだけ precache・データ/認証は常にネットワーク」が自動的に成立する。
//   （NavigationRoute の denylist はパス部分 pathname+search にしかマッチせず、
//     ホスト名 supabase.co 等を書いても効かない。誤解を招くので最初から書かない方針）
const navigationHandler = createHandlerBoundToURL(
  `${import.meta.env.BASE_URL}index.html`,
)
registerRoute(new NavigationRoute(navigationHandler))
