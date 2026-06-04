/*
 * check-deploy.mjs — デプロイ済みサイトの「白画面検知」自律チェック
 *
 * 何のため？
 *   Vercel / GitHub Pages に出したアプリが「真っ白で何も出ない」状態を、
 *   人間がブラウザの検証ツールを開いてエラーをコピペしなくても、
 *   ヘッドレスブラウザ（Playwright）が自動で開いて判定するためのスクリプト。
 *
 * 何を見る？
 *   1. console のエラー出力（console.error）
 *   2. ページ内で投げられた未捕捉の例外（pageerror）
 *   3. 失敗したネットワークリクエスト（requestfailed）と 4xx/5xx レスポンス
 *      … base 不一致による asset 404（白画面の典型原因）はここで必ず引っかかる
 *   4. React が実際にマウントできたか（#root の中身が空でないか）
 *   そして最後にスクリーンショットを保存する。
 *
 * 使い方:
 *   node scripts/check-deploy.mjs                       # 既定 = Vercel 本番
 *   node scripts/check-deploy.mjs https://example.com/  # URL を明示
 *   npm run check:deploy -- https://example.com/        # npm 経由
 *
 * 終了コード: 問題なし=0 / 問題あり=1（CI やスクリプトから成否を判定できる）
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// チェック対象 URL。コマンドライン引数で上書きでき、無ければ Vercel 本番を見る。
const TARGET_URL = process.argv[2] ?? 'https://sleepingdreams.vercel.app/'

// スクショの保存先（このファイルからの相対で scripts/.deploy-check/ 配下）。
// 生成物なので .gitignore で除外する（コミットしない）。
const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '.deploy-check')

// 収集したエラーをためる配列。最後にまとめて表示・判定する。
const consoleErrors = []
const pageErrors = []
const networkErrors = []

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  // headless（画面なし）でブラウザを起動。CI でもローカルでも同じ条件で回せる。
  const browser = await chromium.launch()
  // 実機に寄せてスマホ相当のビューポートにする（このアプリはモバイルファースト）。
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 12/13/14 相当
  })
  const page = await context.newPage()

  // --- 各種エラーを“発生したそばから”拾うリスナーを先に仕掛ける ---
  // console.error 系（type が 'error' のものだけ拾う。log/info は無視）
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  // ページ内の未捕捉例外（React のレンダリング中クラッシュなどはここに来る）
  page.on('pageerror', (err) => {
    pageErrors.push(err.message)
  })
  // ネットワーク自体が失敗（DNS/接続断/CORS で送れない等）
  page.on('requestfailed', (req) => {
    networkErrors.push(`FAILED ${req.method()} ${req.url()} — ${req.failure()?.errorText ?? '不明'}`)
  })
  // レスポンスは返ったが 4xx/5xx（asset 404 = base 不一致はここで捕まる）
  page.on('response', (res) => {
    const s = res.status()
    if (s >= 400) networkErrors.push(`HTTP ${s} ${res.url()}`)
  })

  console.log(`\n🔍 チェック対象: ${TARGET_URL}\n`)

  // ページを開く。'networkidle' = 通信が落ち着くまで待つ（asset 読み込みの成否を取りこぼさない）。
  let navOk = true
  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 })
  } catch (e) {
    navOk = false
    pageErrors.push(`goto 失敗: ${e.message}`)
  }

  // --- 白画面判定: React は #root にマウントする。中身が空なら描画されていない ---
  // （base 不一致だと JS が 404 で読めず、#root が空のまま＝白画面になる）
  const rootHtml = await page.evaluate(() => {
    const root = document.querySelector('#root')
    return root ? root.innerHTML.trim() : null
  }).catch(() => null)
  const rootMounted = !!rootHtml && rootHtml.length > 0

  // 念のため見た目も残す（人間が後から確認できるように）。
  const shotPath = join(OUT_DIR, 'screenshot.png')
  await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {})

  await browser.close()

  // --- 結果レポート ---
  const ok =
    navOk &&
    rootMounted &&
    consoleErrors.length === 0 &&
    pageErrors.length === 0 &&
    networkErrors.length === 0

  console.log('────────── 結果 ──────────')
  console.log(`ページ遷移        : ${navOk ? 'OK' : '失敗'}`)
  console.log(`#root マウント     : ${rootMounted ? 'OK（描画あり）' : 'NG（空＝白画面の疑い）'}`)
  console.log(`console エラー     : ${consoleErrors.length} 件`)
  console.log(`ページ例外        : ${pageErrors.length} 件`)
  console.log(`ネットワーク異常   : ${networkErrors.length} 件`)
  console.log(`スクショ          : ${shotPath}`)

  const dump = (title, arr) => {
    if (arr.length === 0) return
    console.log(`\n── ${title} ──`)
    arr.forEach((m) => console.log(`  • ${m}`))
  }
  dump('console エラー', consoleErrors)
  dump('ページ例外', pageErrors)
  dump('ネットワーク異常', networkErrors)

  console.log(`\n${ok ? '✅ 問題なし' : '❌ 問題あり（上記を確認）'}\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error('チェック実行中に想定外のエラー:', e)
  process.exit(1)
})
