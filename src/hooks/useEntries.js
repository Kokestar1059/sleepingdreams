/*
 * useEntries — エントリーの CRUD ロジックをまとめたカスタムフック（Supabase 版）
 *
 * 役割:
 *   - Supabase の entries テーブルから自分のエントリーを読み込んで state に保持
 *   - create / update / remove / 日付フィルタを公開
 *   - 書き込みは「楽観的更新（optimistic update）」で即座に画面へ反映し、
 *     裏で Supabase に同期。失敗したらサーバーから再取得して自己修復する。
 *
 * ■ Phase 1（localStorage）からの変更点と、その理由（学習メモ）
 *   - 保存先が localStorage → Supabase（クラウド）に変わった。
 *     ネットワーク越しなので CRUD は「非同期（async）」になる。
 *   - 「誰のデータか」は RLS（Row Level Security）が auth.uid() で自動的に絞り込む。
 *     なので select に user_id の where を書かなくても、自分の行しか返ってこない。
 *     insert 時の user_id も DB 側の `default auth.uid()` が自動で埋める（送らない）。
 *
 * ■ 楽観的更新（optimistic update）とは
 *   「サーバーの応答を待たずに、成功する前提で先に画面を更新する」やり方。
 *   寝起きの片手操作で「保存ボタンを押す → 一瞬待たされる」体験を避けたい。
 *   先に state を変えてしまえば UI は即反応する。万一サーバーが失敗したら、
 *   その時だけ refetch() で「サーバーの真実」を取り直して画面を巻き戻す。
 *   （スナップショットを持って手作業で rollback するより、再取得の方が確実で単純）
 *
 * ■ DB（snake_case）と アプリ（camelCase）の橋渡し
 *   Postgres の列は entry_date / created_at のように snake_case。
 *   アプリ内のコンポーネントは entryDate / createdAt（camelCase）を期待している。
 *   読み出し時に rowToEntry() で変換し、書き込み時は snake_case のオブジェクトを渡す。
 *   この「境界での変換」を 1 箇所に閉じ込めると、表示側は DB の都合を知らずに済む。
 */

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// DB の 1 行（snake_case）をアプリ内の形（camelCase）に変換する。
// 表示側は entry.entryDate / entry.createdAt を期待しているため、ここで吸収する。
function rowToEntry(row) {
  return {
    id: row.id,
    entryDate: row.entry_date,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function useEntries() {
  // 自分の全エントリー。初期値は空配列で、マウント後に Supabase から読み込む。
  const [entries, setEntries] = useState([])
  // 初回ロード中フラグ。Calendar 側で「読み込み中…」を出すのに使う。
  const [loading, setLoading] = useState(true)

  /**
   * サーバーから自分のエントリーを取り直して state を上書きする。
   * - 初回ロードと、楽観的更新が失敗したときの「巻き戻し」の両方で使う。
   * - useCallback で関数の同一性を保つ（useEffect の依存に入れても無限ループしない）。
   */
  const refetch = useCallback(async () => {
    // RLS が自動で「自分の user_id の行」だけに絞るので、where は不要。
    // created_at 昇順で取り、Phase 1 の localStorage（append 順 = 作成順）と並びを揃える。
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[entries] 読み込みに失敗しました:', error.message)
      return
    }
    setEntries(data.map(rowToEntry))
  }, [])

  // マウント時に 1 回だけ初回ロード。
  // （Calendar はログイン後にだけマウントされるので、この時点でセッションは確立済み）
  useEffect(() => {
    // 即時実行の async 関数で包む（useEffect のコールバック自体は async にできないため）。
    ;(async () => {
      await refetch()
      setLoading(false)
    })()
  }, [refetch])

  /**
   * 指定日のエントリーだけを抜き出す（同期・ローカルの state を filter するだけ）。
   * モーダルで「その日の一覧」を出すときに使う。
   *
   * 並び順は createdAt 降順（新しいものが上）。
   *   - localeCompare を使い、createdAt が等値でも 0 を返して安定ソートに乗せる。
   *     （ISO 8601 文字列は辞書順 = 時系列順。欠損時も '' 扱いで落ちない）
   *   - ES2019 以降の sort は stable なので、等値要素は元の格納順（= 作成順）を保つ。
   */
  const getEntriesByDate = (dateKey) => {
    return entries
      .filter((e) => e.entryDate === dateKey)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }

  /**
   * 新規エントリーを追加する（楽観的更新）。
   *
   * - id / createdAt / updatedAt はクライアントで生成して DB にもそのまま渡す。
   *   こうすると「画面に出した楽観的な行」と「DB に入る行」の id が一致し、
   *   後からサーバーの行と突き合わせ直す処理（reconciliation）が不要になる。
   * - user_id は送らない。DB の `default auth.uid()` が今ログイン中の人を自動で埋める。
   * - 失敗したら追加分を取り消すため refetch() でサーバーの真実に戻す。
   *
   * @returns 楽観的に作成したエントリー（呼び出し側で参照したい場合のため）
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

    // 1) 先に画面へ反映（楽観的）。
    setEntries((prev) => [...prev, entry])

    // 2) 裏で Supabase に挿入。await しないので呼び出し側（モーダル）は即座に次へ進める。
    ;(async () => {
      const { error } = await supabase.from('entries').insert({
        id: entry.id,
        entry_date: entry.entryDate,
        title: entry.title,
        body: entry.body,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      })
      if (error) {
        console.error('[entries] 作成に失敗しました:', error.message)
        refetch() // 楽観的に足した行を取り消す（サーバーの真実で上書き）
      }
    })()

    return entry
  }

  /**
   * 既存エントリーを部分更新する（楽観的更新）。
   *
   * - patch から title / body だけを取り出して使う（id や entryDate は書き換えさせない）。
   *   呼び出し元が余計なキーを混ぜても DB に流れないようにする防御。
   * - 一致しない id が来たら map がそのまま素通しするので実害なし。
   */
  const updateEntry = (id, patch) => {
    const now = new Date().toISOString()
    // 受け取ってよいキーだけに絞る（ホワイトリスト）。
    const safePatch = { title: patch.title, body: patch.body }

    // 1) 楽観的にローカルを更新。
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, ...safePatch, updatedAt: now } : e
      )
    )

    // 2) 裏で Supabase を更新。RLS により他人の行は eq でヒットしても更新されない。
    ;(async () => {
      const { error } = await supabase
        .from('entries')
        .update({ ...safePatch, updated_at: now })
        .eq('id', id)
      if (error) {
        console.error('[entries] 更新に失敗しました:', error.message)
        refetch()
      }
    })()
  }

  /**
   * 指定 id のエントリーを削除する（楽観的更新）。
   */
  const deleteEntry = (id) => {
    // 1) 楽観的にローカルから除く。
    setEntries((prev) => prev.filter((e) => e.id !== id))

    // 2) 裏で Supabase から削除。
    ;(async () => {
      const { error } = await supabase.from('entries').delete().eq('id', id)
      if (error) {
        console.error('[entries] 削除に失敗しました:', error.message)
        refetch() // 消し過ぎ/消し損ねを補正
      }
    })()
  }

  return {
    entries,
    loading,
    getEntriesByDate,
    createEntry,
    updateEntry,
    deleteEntry,
  }
}
