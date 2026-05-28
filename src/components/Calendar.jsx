/*
 * Calendar コンポーネント — カレンダー画面の本体
 *
 * 役割:
 *   - 「現在表示中の月」の状態を持つ（このアプリで最初の useState 登場）
 *   - Header を出し、< / > が押されたら月を進めたり戻したりする
 *   - dateUtils.buildMonthGrid で日付グリッドを作り、CalendarDay を 7 列で並べる
 *   - 日付セルがクリックされたら、いまは console.log するだけ（モーダルは Issue #3）
 *
 * 設計のポイント（学習メモ）:
 *   - useState は「コンポーネント内の記憶領域」。
 *     `const [currentMonth, setCurrentMonth] = useState(new Date())`
 *     と書くと、currentMonth が現在値、setCurrentMonth(newValue) で更新できる。
 *     setXxx を呼ぶと React は「再レンダリング」をスケジュールし、
 *     新しい currentMonth で関数全体が再実行される。
 *
 *   - 状態を更新するときは「前の値を直接いじらず、新しい値を渡す」のが鉄則（イミュータブル）。
 *     ここでは addMonths が新しい Date を返すので OK。
 *
 *   - useState の初期値に関数ではなく `new Date()` を直接書くと、
 *     厳密には毎レンダリングで Date が作られるが React は初回のみ採用する。
 *     Date 生成は安いので問題ないが、重い初期化なら useState(() => 重い処理()) と
 *     関数で渡すのが定石。
 */

import { useState } from 'react'
import Header from './Header'
import CalendarDay from './CalendarDay'
import { addMonths, buildMonthGrid, WEEKDAY_LABELS } from '../utils/dateUtils'

function Calendar() {
  // 現在表示中の「月」を管理する state。初期値は今月（実行時の今日）。
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // 前月ボタンが押されたときのハンドラ。
  // setCurrentMonth に「前月の Date」を渡すだけ。
  // ここで prev => addMonths(prev, -1) のように関数形式で渡すと
  // 「最新の state」を確実に元に計算できる（連打されても安全）。
  const handlePrev = () => setCurrentMonth((prev) => addMonths(prev, -1))
  const handleNext = () => setCurrentMonth((prev) => addMonths(prev, 1))

  // 日付セルがクリックされたときのハンドラ（Issue #3 でモーダル表示に置き換える）。
  const handleSelectDay = (dateKey) => {
    // eslint-disable-next-line no-console
    console.log('selected:', dateKey)
  }

  // currentMonth が変わるたびに、グリッドも再計算される（関数コンポーネントが再実行されるため）。
  // パフォーマンス上はメモ化の余地もあるが、月 1 回程度の再計算なので素朴に呼ぶ。
  const weeks = buildMonthGrid(currentMonth)

  return (
    // 画面全体のレイアウト。
    //   max-w-md : スマホ幅基準。PC でも横に広がりすぎない
    //   px-4     : 端の余白
    //   py-6     : 上下の余白
    <div className="w-full max-w-md mx-auto px-4 py-6">
      <Header currentMonth={currentMonth} onPrev={handlePrev} onNext={handleNext} />

      {/* 曜日ヘッダー（日〜土）。grid-cols-7 で 7 等分する */}
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

      {/*
        日付グリッド本体。
        weeks は 2 次元配列だが、CSS Grid を 7 列にして全セルを 1 つの grid に流し込むと
        週ごとに改行する必要がなく、レイアウトが自然に組める。

        React の key について（学習メモ）:
          - 配列を map でレンダリングするときは key 必須。
          - key は「兄弟の中で一意」であればよい。ここでは dateKey ("YYYY-MM-DD") が
            グリッド全体で重複しないので、それをそのまま使うのが安全で読みやすい。
      */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((cell) => (
          <CalendarDay
            key={cell.dateKey}
            cell={cell}
            onSelect={handleSelectDay}
          />
        ))}
      </div>
    </div>
  )
}

export default Calendar
