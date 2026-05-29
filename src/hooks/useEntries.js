/*
 * useEntries — 夢日記エントリーの CRUD ロジックをまとめたカスタムフック。
 *
 * 役割:
 *   - localStorage から読み出した state を保持
 *   - create / update / remove / 日付フィルタを公開
 *   - state を更新するたびに自動で localStorage に永続化
 *
 * 設計のポイント（学習メモ）:
 *
 * 1) カスタムフックとは
 *    - 名前が `use` で始まり、関数コンポーネントから呼ばれる関数。
 *    - 内部で useState / useEffect などの組み込みフックを使える。
 *    - 「状態 + その操作関数」を 1 セットにして外から使いやすくする道具。
 *    - ここでは EntryModal と Calendar の両方からエントリーを触りたいので、
 *      ロジックを 1 箇所にまとめておくと重複が消える。
 *
 * 2) 初期 state の lazy initializer
 *    - `useState(loadEntries())` と書くと毎レンダリングで loadEntries() が呼ばれる
 *      （結果は破棄されるが、無駄に localStorage を叩く）。
 *    - `useState(() => loadEntries())` のように関数で渡すと、
 *      React は初回マウント時だけその関数を実行する。これが lazy initializer。
 *
 * 3) useEffect で永続化
 *    - entries が変わるたびに localStorage へ書き込む。
 *    - ただし「初回マウントの effect」はスキップする（後述）。
 *
 * 3.5) 初回 effect をスキップする理由
 *    - storage.js は JSON が壊れていたら静かに `[]` を返すフォールバック設計。
 *    - もし初回 effect で素直に `saveEntries(entries)` を呼ぶと、
 *      ユーザーの壊れかけデータが「空配列で上書き」されて完全に消える。
 *      （旧バージョンが書いた未知形式、手動で localStorage をいじって壊した場合など）
 *    - useRef で「初回マウントか？」を覚えておき、初回だけは書き込みをスキップ。
 *      そうすれば「ユーザーが何か操作して state を変えたとき」だけ保存される。
 *    - これは「props → setState」系の anti-pattern ではなく、
 *      effect のうち「同期化が不要な初回」を明示的に外す典型的なパターン。
 *
 * 4) state 更新はイミュータブルに
 *    - 既存配列を push せず、必ず新しい配列を返す（[...prev, item] / map / filter）。
 *    - React は参照の比較で差分検出するので、同じ配列を破壊的に変えると
 *      再レンダリングがトリガーされない＝バグになる。
 *
 * 5) 関数の安定化（useCallback）は今は不要
 *    - props でメモ化された子に渡すケースで威力を発揮するが、
 *      このアプリは規模が小さく React 19 の自動最適化に任せて十分。
 *      必要が出てから足す。
 */

import { useEffect, useRef, useState } from 'react'
import { loadEntries, saveEntries } from '../utils/storage'

/**
 * エントリーの CRUD カスタムフック。
 *
 * @returns {{
 *   entries: Array<Object>,
 *   getEntriesByDate: (dateKey: string) => Array<Object>,
 *   createEntry: (input: { entryDate: string, title: string, body: string }) => Object,
 *   updateEntry: (id: string, patch: { title?: string, body?: string }) => void,
 *   deleteEntry: (id: string) => void,
 * }}
 */
export function useEntries() {
  // localStorage を初回だけ読む（lazy initializer）。
  const [entries, setEntries] = useState(() => loadEntries())

  // 「初回マウントの effect か？」フラグ。
  //   - useRef は値が変わっても再レンダリングをトリガーしない箱。
  //   - useState だと書き換えるたびに再レンダされてしまうので不適。
  //   - React Strict Mode の二重マウント対策にもなる（dev では mount → unmount → mount の
  //     順で走るが、本物のユーザー操作前なら必ず初期値 [] のままなので保存する必要が無い）。
  const isFirstRender = useRef(true)

  // entries が更新されるたびに永続化。
  // 依存配列に entries を入れているので、内容が変わるたびにこの effect が再実行される。
  //
  // ただし、初回マウントだけは「localStorage を読んだだけ」の状態なので保存しない。
  //   - もし loadEntries() がフォールバックで [] を返している場合（JSON 破損など）、
  //     ここで素直に保存すると破損データが空配列で上書きされ、復旧の可能性まで消える。
  //   - 「ユーザー操作で entries が変わったとき」だけ保存することで、
  //     破損データに不可逆な書き込みをするのを回避する。
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    saveEntries(entries)
  }, [entries])

  /**
   * 指定日のエントリーだけを抜き出す。
   * モーダルで「その日の一覧」を出すときに使う。
   *
   * 並び順は createdAt 降順（新しいものが上）に明示する。
   *   - entries 配列の格納順は createEntry の append 順 = createdAt 昇順だが、
   *     それに暗黙依存すると将来並びが変わったときに表示が崩れる。
   *   - ユーザー視点では「さっき書いた夢」が一番上に来る方が自然。
   *   - sort は元配列を破壊するので、filter で作った新しい配列に対して呼ぶ。
   *
   * 軽量な配列フィルタなので毎レンダリング呼んでも問題ない。
   * （将来 entries が肥大化したら useMemo の出番）
   */
  const getEntriesByDate = (dateKey) => {
    return entries
      .filter((e) => e.entryDate === dateKey)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  /**
   * 新規エントリーを追加する。
   *
   * 設計メモ:
   *   - id は crypto.randomUUID() で生成。標準APIなので追加依存ゼロ。
   *   - createdAt / updatedAt は ISO 文字列で持つ（JSONとして扱いやすい）。
   *   - state 更新は関数形式 `setEntries(prev => [...])` を使う。
   *     これで「直近の state」を確実に踏まえて計算できる（連続呼び出しに強い）。
   *
   * @returns 作成したエントリー（呼び出し側で参照したい場合のため）
   */
  const createEntry = ({ entryDate, title, body }) => {
    const now = new Date().toISOString()
    const entry = {
      id: crypto.randomUUID(),
      entryDate,
      title,
      body,
      createdAt: now,
      updatedAt: now,
    }
    setEntries((prev) => [...prev, entry])
    return entry
  }

  /**
   * 既存エントリーを部分更新する。
   *
   * 設計メモ:
   *   - patch には title / body だけ来る想定。
   *     id や createdAt は変更しない方針なので、patch を後ろに展開して上書きされない構造。
   *   - 一致しない id が来たら何もしない（防御的）。
   */
  const updateEntry = (id, patch) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : e
      )
    )
  }

  /**
   * 指定 id のエントリーを削除する。
   * filter は新しい配列を返すのでイミュータブル更新になる。
   */
  const deleteEntry = (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return {
    entries,
    getEntriesByDate,
    createEntry,
    updateEntry,
    deleteEntry,
  }
}
