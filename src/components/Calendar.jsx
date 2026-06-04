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
import MicIcon from './MicIcon'
import { useEntries } from '../hooks/useEntries'
import { isSpeechRecognitionSupported } from '../hooks/useSpeechRecognition'
import { addMonths, buildMonthGrid, toDateKey, WEEKDAY_LABELS } from '../utils/dateUtils'

function Calendar() {
  // 現在表示中の「月」を管理する state。初期値は今月（実行時の今日）。
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // モーダル制御：選択された日付（dateKey）。null ならモーダルは閉じている扱い。
  const [selectedDateKey, setSelectedDateKey] = useState(null)

  // 「クイック音声 FAB から開いたか」のフラグ。
  //   true のときだけ EntryModal を「新規フォーム＋音声自動開始」モードで開く。
  //   日付セルから普通に開いたとき（false）は従来どおり一覧表示から始まる。
  const [openInVoiceMode, setOpenInVoiceMode] = useState(false)

  // エントリーの CRUD はカスタムフックに集約。
  // ここから受け取った関数をそのままモーダルに props で渡せばよい。
  // loading は Supabase からの初回読み込み中フラグ（Phase 2 で追加）。
  const { entries, loading, getEntriesByDate, createEntry, updateEntry, deleteEntry } =
    useEntries()

  // 月ナビゲーション
  const handlePrev = () => setCurrentMonth((prev) => addMonths(prev, -1))
  const handleNext = () => setCurrentMonth((prev) => addMonths(prev, 1))

  // 日付セルがクリックされたとき：その日付でモーダルを開く（通常モード）。
  //   FAB 経由ではない普通の開き方なので、音声モードのフラグは下ろしておく。
  const handleSelectDay = (dateKey) => {
    setOpenInVoiceMode(false)
    setSelectedDateKey(dateKey)
  }

  // クイック音声 FAB：今日の日付で、新規フォーム＋音声自動開始モードで開く。
  //   toDateKey(new Date()) で「実行時の今日」をローカルタイムゾーン基準の
  //   "YYYY-MM-DD" にする（CLAUDE.md の日付ルール）。
  const handleQuickVoice = () => {
    setOpenInVoiceMode(true)
    setSelectedDateKey(toDateKey(new Date()))
  }

  // モーダルを閉じる。音声モードのフラグも一緒に下ろす（次に開くときに残さない）。
  const handleCloseModal = () => {
    setSelectedDateKey(null)
    setOpenInVoiceMode(false)
  }

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
        クイック音声 FAB（カレンダー下の余白に置く）。
          - 寝起きに「カレンダーを操作せず、今日の分をすぐ喋って残す」ための近道。
            タップ → 今日の新規フォームが開き、その場で録音が始まる。
          - 音声非対応ブラウザでは出さない（押してもフォームにマイクが無く、誤誘導になるため）。
          - 円形ボタンは原研哉トーンで主張しすぎないよう、淡く広い影で「紙の上に浮く」質感に。
            mt-10 で日付グリッドから十分離し、余白（間）の中央にぽつんと置く。
          - タップターゲットは h-16 w-16(64px) と大きめ。寝ぼけた片手でも外さない。
          - 下の小さなラベルは案内。text-gray-300 で静かに添える。
      */}
      {isSpeechRecognitionSupported && (
        <div className="mt-10 flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={handleQuickVoice}
            aria-label="音声で今日のメモを追加"
            className="
              h-16 w-16 rounded-full
              bg-gray-900 text-white
              flex items-center justify-center
              shadow-[0_6px_24px_rgba(0,0,0,0.14)]
              hover:bg-gray-800 active:opacity-80 transition-colors
            "
          >
            <MicIcon size={24} />
          </button>
          <span className="text-[11px] text-gray-300 tracking-[0.1em]">
            音声でメモ
          </span>
        </div>
      )}

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
          autoVoice={openInVoiceMode}
        />
      )}
    </div>
  )
}

export default Calendar
