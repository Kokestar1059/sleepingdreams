/*
 * Calendar コンポーネント — カレンダー画面の本体
 *
 * 役割:
 *   - 「現在表示中の月」を useState で持つ
 *   - 日付タップで EntryModal を開き、そのまま CRUD を行う
 *   - 各日にエントリーがあるかどうかを CalendarDay に渡してドット表示させる
 *   - useEntries フックで永続化を含む CRUD ロジックをまるごと利用する
 *
 * 設計のポイント（学習メモ）:
 *
 * 1) 状態の置き場所
 *    - currentMonth（カレンダー画面の状態） → このコンポーネント
 *    - 選択中の日付 + モーダル開閉状態 → このコンポーネント
 *    - エントリーの中身（永続化込み） → useEntries フックの中
 *
 *    「View 固有の状態」と「アプリのドメインデータ」を別の場所に置くと、
 *    フックを差し替えれば永続化先を変えられる（Phase 2 で Supabase に移行する伏線）。
 *
 * 2) hasEntry の事前計算（Map）
 *    - 各セルで「この日付にエントリーがあるか？」を毎回 filter で見ると O(セル数 × エントリー数)。
 *    - 1 度だけ Set にしておけば O(セル数) で済む。
 *    - useMemo を使えばさらに最適化できるが、月 1 回再計算なので今は素朴に書く。
 */

import { useState } from 'react'
import Header from './Header'
import CalendarDay from './CalendarDay'
import EntryModal from './EntryModal'
import { useEntries } from '../hooks/useEntries'
import { addMonths, buildMonthGrid, WEEKDAY_LABELS } from '../utils/dateUtils'

function Calendar() {
  // 現在表示中の「月」を管理する state。初期値は今月（実行時の今日）。
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // モーダル制御：選択された日付（dateKey）。null ならモーダルは閉じている扱い。
  const [selectedDateKey, setSelectedDateKey] = useState(null)

  // エントリーの CRUD はカスタムフックに集約。
  // ここから受け取った関数をそのままモーダルに props で渡せばよい。
  const { entries, getEntriesByDate, createEntry, updateEntry, deleteEntry } = useEntries()

  // 月ナビゲーション
  const handlePrev = () => setCurrentMonth((prev) => addMonths(prev, -1))
  const handleNext = () => setCurrentMonth((prev) => addMonths(prev, 1))

  // 日付セルがクリックされたとき：その日付でモーダルを開く。
  const handleSelectDay = (dateKey) => setSelectedDateKey(dateKey)

  // モーダルを閉じる
  const handleCloseModal = () => setSelectedDateKey(null)

  // 月グリッド生成
  const weeks = buildMonthGrid(currentMonth)

  // 「エントリーがある日付」の集合を一度だけ作る。
  // Set にしておくと has() が O(1) で引ける。
  const entryDateSet = new Set(entries.map((e) => e.entryDate))

  // モーダルに渡す「その日の一覧」。selectedDateKey が null のときは空配列で安全に。
  const entriesForSelectedDate = selectedDateKey ? getEntriesByDate(selectedDateKey) : []

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6">
      <Header currentMonth={currentMonth} onPrev={handlePrev} onNext={handleNext} />

      {/* 曜日ヘッダー（日〜土） */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-xs text-gray-400 py-2"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 日付グリッド本体 */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((cell) => (
          <CalendarDay
            key={cell.dateKey}
            cell={cell}
            hasEntry={entryDateSet.has(cell.dateKey)}
            onSelect={handleSelectDay}
          />
        ))}
      </div>

      {/*
        エントリーモーダル。
        selectedDateKey が null のときはコンポーネント自体を描画しない。
        こうすると「閉→開」のたびに毎回マウントされ、内部 state が自動でリセットされる。
        （useEffect で setState する anti-pattern を避けるための設計）
      */}
      {selectedDateKey !== null && (
        <EntryModal
          dateKey={selectedDateKey}
          entries={entriesForSelectedDate}
          onClose={handleCloseModal}
          onCreate={createEntry}
          onUpdate={updateEntry}
          onDelete={deleteEntry}
        />
      )}
    </div>
  )
}

export default Calendar
