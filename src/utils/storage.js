/*
 * localStorage の薄いラッパー。
 *
 * 役割:
 *   - エントリー配列の読み書きを 1 箇所にまとめる
 *   - JSON のシリアライズ／パースを隠す
 *   - localStorage が壊れたり JSON が崩れていても落ちないように try/catch でガード
 *
 * 設計のポイント（学習メモ）:
 *   - localStorage は同期 API なのでこのファイルは Promise を返さない。
 *   - キー名は 1 箇所に集約しておくと、後でリネームや Phase 2（Supabase）への
 *     移行スクリプトを書くときに参照しやすい。
 *   - JSON.parse は文字列が壊れていると例外を投げる。
 *     ユーザーが手動で localStorage をいじったり、別バージョンのアプリが
 *     違う形式で書き込んだ場合に備えて try/catch で握りつぶし、空配列を返す。
 *   - "壊れていたら捨てる" は雑だが、Phase 1 ではバックアップ手段（JSONエクスポート）
 *     を別途用意する前提なので OK。本格運用前にここを厚くする。
 */

// localStorage のキー名。CLAUDE.md のデータモデル節に合わせる。
const STORAGE_KEY = 'dream_entries'

/**
 * 全エントリーを localStorage から読み出す。
 * 中身が無い／壊れている場合は空配列を返す（呼び出し側でフォールバック不要）。
 *
 * @returns {Array<Object>} エントリーの配列（順序は保存時のまま）
 */
export function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [] // 初回起動などキー未登録のケース
    const parsed = JSON.parse(raw)
    // JSON.parse は何でも返しうるので、配列でなければ捨てる（防御的プログラミング）
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    // JSON が壊れている、localStorage が無効化されている等。
    // ここでログを出すと毎レンダリングで騒がしくなるので静かに空配列を返す。
    return []
  }
}

/**
 * エントリー配列を localStorage に書き込む（全置換）。
 *
 * 部分更新ではなく毎回まるごと書き換える方針:
 *   - Phase 1 で扱う件数は多くて数百件程度（人間が見る夢日記の規模）
 *   - 全置換にしておくと「保存されている内容＝引数の配列」が常に保証され、
 *     差分管理のバグが入り込む余地がない。
 *
 * @param {Array<Object>} entries 書き込みたいエントリー配列
 */
export function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // QuotaExceededError や、シークレットモードで localStorage が
    // 書き込み禁止になっているケースなど。
    // Phase 1 ではユーザーに通知する仕組みを持たないので静かに失敗する。
    // 後で「保存に失敗しました」トーストを足す候補ポイント。
  }
}
