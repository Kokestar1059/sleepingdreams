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
 * 2) hasEntry の事前計算（Set）
 *    - 各セルで「この日付にエントリーがあるか？」を毎回 filter で見ると O(セル数 × エントリー数)。
 *    - 1 度だけ Set にしておけば has() が O(1) で引けて、合計 O(セル数) で済む。
 *    - さらに useMemo で「entries が変わったときだけ」再計算するようにし、
 *      月ナビゲーションやモーダル開閉のような無関係な再レンダで作り直さない。
 *      （Set の生成自体は軽いが、依存配列で意図を明示すると後から読む人に親切）
 */

import { useMemo, useState } from 'react'
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
  // loading は Supabase からの初回読み込み中フラグ（Phase 2 で追加）。
  const { entries, loading, getEntriesByDate, createEntry, updateEntry, deleteEntry } =
    useEntries()

  // 月ナビゲーション
  const handlePrev = () => setCurrentMonth((prev) => addMonths(prev, -1))
  const handleNext = () => setCurrentMonth((prev) => addMonths(prev, 1))

  // 日付セルがクリックされたとき：その日付でモーダルを開く。
  const handleSelectDay = (dateKey) => setSelectedDateKey(dateKey)

  // モーダルを閉じる
  const handleCloseModal = () => setSelectedDateKey(null)

  // 月グリッド生成
  const weeks = buildMonthGrid(currentMonth)

  // 「エントリーがある日付」の集合を作る。
  //   - Set にしておくと has() が O(1) で引ける（CalendarDay 毎の判定が速い）。
  //   - useMemo の依存配列は [entries]。entries 参照が変わったときだけ作り直し、
  //     月ナビ・モーダル開閉のような無関係な再レンダではキャッシュを再利用する。
  const entryDateSet = useMemo(
    () => new Set(entries.map((e) => e.entryDate)),
    [entries]
  )

  // モーダルに渡す「その日の一覧」。selectedDateKey が null のときは空配列で安全に。
  const entriesForSelectedDate = selectedDateKey ? getEntriesByDate(selectedDateKey) : []

  return (
    // 外周余白（原研哉トーン）:
    //   px-4 py-6 → px-5 py-8 をベースに、画面の縁に「間（ま）」を作る。
    //   外周が広いほど「中に何かが宿っている」静けさが生まれる。
    //   上方向は AppHeader（pt-5 pb-3 + border-b）の下に続くので pt-4 に抑える。
    //   AppHeader の pb-3(12px) と合わせて、ヘッダー下線〜月ナビ間が約 28px の「間（ま）」になる。
    <div className="w-full max-w-md mx-auto px-5 pt-4 pb-8">
      <Header currentMonth={currentMonth} onPrev={handlePrev} onNext={handleNext} />

      {/*
        初回ロード中インジケータ。
          - Supabase からエントリーを取得し終えるまでの短い間だけ出す。
          - ドット（記録の有無）は読み込み完了まで確定しないため、
            「まだ判定中」であることを薄く伝えておくと、寝起きでも誤解しない。
          - 高さ 0 ではなく一定の行を確保し、消えるときにレイアウトが飛ばないようにする。
          - aria-live="polite" でスクリーンリーダーにも状態変化を控えめに伝える。
      */}
      <div
        aria-live="polite"
        className="h-5 text-center text-xs tracking-[0.08em] text-gray-300"
      >
        {loading ? '読み込み中…' : ''}
      </div>

      {/*
        曜日ヘッダー（日〜土）
          - mb-1 → mb-2: 曜日ラベルと日付グリッドの間を少し開けてグルーピングを明確に
          - text-gray-400 → text-gray-300 + tracking: 曜日は補助情報。さらに引いて
            日付数字を前に出す。字間を少し足して整える。
      */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-xs text-gray-300 tracking-[0.06em] py-2"
          >
            {label}
          </div>
        ))}
      </div>

      {/*
        日付グリッド本体
          gap-1 → gap-0: セル間の隙間をなくしてタップ領域を最大化（誤タップ防止）。
          視覚的な境界は背景色のホバー変化だけで表現する（線を消すのが原研哉）。
      */}
      <div className="grid grid-cols-7 gap-0">
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
