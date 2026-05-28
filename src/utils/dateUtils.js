/*
 * 日付まわりのユーティリティ関数群。
 *
 * 設計方針（CLAUDE.md より抜粋）:
 *   - 日付の比較や永続化は文字列 "YYYY-MM-DD" 形式で行う。
 *     → Date オブジェクト同士の比較はタイムゾーンずれの温床なので避ける。
 *   - ブラウザのローカルタイムゾーンを採用（日本前提）。
 *
 * ここで提供する関数:
 *   - toDateKey(date)         : Date → "YYYY-MM-DD" 文字列
 *   - formatYearMonth(date)   : Date → "2026年5月" 形式の見出し
 *   - addMonths(date, n)      : 月の加減算（前月/翌月ナビ用）
 *   - buildMonthGrid(date)    : カレンダーグリッド（日〜土の 7 列 × 5〜6 行）を生成
 */

// --- 内部ヘルパ ----------------------------------------------------------

// 整数を 2 桁ゼロ埋め文字列にする（例: 5 → "05"）。
// String#padStart は標準 API なのでライブラリ不要。
const pad2 = (n) => String(n).padStart(2, '0')

// --- 公開関数 ------------------------------------------------------------

/**
 * Date を "YYYY-MM-DD" 文字列に変換する。
 *
 * 注意: toISOString() は UTC に変換されてしまうので使わない。
 *       例：日本時間 2026-05-26 00:30 を toISOString() すると
 *           "2026-05-25T15:30:00.000Z" になり、日付が 1 日ずれる。
 *       getFullYear / getMonth / getDate はローカルタイムゾーン基準で取れるので安全。
 */
export function toDateKey(date) {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1) // getMonth は 0 始まりなので +1
  const d = pad2(date.getDate())
  return `${y}-${m}-${d}`
}

/**
 * Date を "2026年5月" のような日本語見出しに整形する。
 * ヘッダーの月ナビゲーション表示用。
 */
export function formatYearMonth(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

/**
 * 月を加減算した新しい Date を返す（元の date は変更しない）。
 * 例: addMonths(2026-05-15, -1) → 2026-04-15
 *     addMonths(2026-05-15,  1) → 2026-06-15
 *
 * 日付（getDate）は 1 に固定して返す。
 *   理由: 月ナビは「月単位」の概念なので、何日かは関係ない。
 *         1 に固定しておくと、例えば 1/31 から +1 ヶ月したときに
 *         2/31 が 3/3 にオーバーフローする事故を防げる。
 */
export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

/**
 * 指定した「月」を表示するための、カレンダーグリッド（2 次元配列）を作る。
 *
 * 戻り値の形:
 *   [
 *     // 第 1 週（日曜始まり）
 *     [
 *       { date: Date, dateKey: "2026-04-26", isCurrentMonth: false, isToday: false },
 *       { date: Date, dateKey: "2026-04-27", isCurrentMonth: false, isToday: false },
 *       ...
 *       { date: Date, dateKey: "2026-05-02", isCurrentMonth: true,  isToday: false },
 *     ],
 *     // 第 2 週、第 3 週 ...
 *   ]
 *
 * 仕様:
 *   - 週は「日曜始まり」（日本の一般的なカレンダーに合わせる）
 *   - 先月末・翌月頭の日付もセルとして埋める（よくあるカレンダーUIと同じ）
 *   - 行数はその月によって 5 行 or 6 行になる
 *
 * 引数:
 *   monthDate : 表示したい月の任意の日付（例: new Date(2026, 4, 15)）
 *   today     : 「今日」と判定する基準日（テスト容易性のため引数化、省略時は実行時の今日）
 */
export function buildMonthGrid(monthDate, today = new Date()) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth() // 0 始まり

  // その月の 1 日が「何曜日」か（0=日, 1=月, ..., 6=土）
  const firstDayWeekday = new Date(year, month, 1).getDay()

  // グリッドの開始日 = その月の 1 日からさかのぼって最初の日曜日
  // 例: 2026/5/1 が金曜（=5）なら 5 日前の 4/26（日）が開始日
  const gridStart = new Date(year, month, 1 - firstDayWeekday)

  // 今日のキー（毎セル比較するので 1 度だけ計算）
  const todayKey = toDateKey(today)

  // 6 週分（= 42 日）まず全て埋める。
  // その後、最終行が「全部翌月の日」なら 5 週にトリムする（よくある最適化）。
  const weeks = []
  for (let w = 0; w < 6; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + w * 7 + d
      )
      week.push({
        date: dayDate,
        dateKey: toDateKey(dayDate),
        isCurrentMonth: dayDate.getMonth() === month,
        isToday: toDateKey(dayDate) === todayKey,
      })
    }
    weeks.push(week)
  }

  // 最終週が全部 isCurrentMonth=false（=翌月だけの週）なら不要なので落とす
  const lastWeek = weeks[weeks.length - 1]
  if (lastWeek.every((cell) => !cell.isCurrentMonth)) {
    weeks.pop()
  }

  return weeks
}

/**
 * 曜日ヘッダー表示用の配列。
 * Calendar 側で .map して描画する。日本語前提。
 */
export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']
