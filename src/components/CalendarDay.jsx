/*
 * CalendarDay コンポーネント — カレンダーの 1 セル（1 日分）
 *
 * 役割:
 *   - 日付の数字を表示する
 *   - 「今日」「今月以外（先月末・翌月頭）」で見た目を変える
 *   - その日にエントリーがあれば下にドット（●）を出す
 *   - クリックされたら親に dateKey ("YYYY-MM-DD") を通知する
 *
 * 設計のポイント（学習メモ）:
 *   - <button> ベースなのは a11y（キーボード操作・スクリーンリーダー対応）のため。
 *   - hasEntry は親（Calendar）で一括計算してから渡してもらう（パフォーマンス節約）。
 *   - ドットは「コンテンツの一部」ではなく装飾なので、relative + 絶対配置で
 *     数字レイアウトに影響を与えないよう絶対配置する。
 *     こうしておくとセルの中央に数字が綺麗に乗ったまま、下端にドットが浮く。
 */

function CalendarDay({ cell, hasEntry, onSelect }) {
  const { date, dateKey, isCurrentMonth, isToday } = cell

  // クラスを動的に組み立てるためのヘルパー。
  // 三項演算子を入れ子にすると読みにくいので、配列に push して join する書き方を採用。
  const classes = [
    // relative はドットを絶対配置するための基準点。
    'relative aspect-square flex items-center justify-center',
    'rounded-md text-sm select-none',
    'transition active:scale-95',
    'hover:bg-gray-100',
  ]

  if (!isCurrentMonth) {
    // 先月末・翌月頭はグレーアウト
    classes.push('text-gray-300')
  } else if (isToday) {
    // 今日は黒背景・白文字でハイライト（モノトーンのアクセント）
    classes.push('bg-gray-900 text-white hover:bg-gray-900')
  } else {
    // 通常の今月の日
    classes.push('text-gray-900')
  }

  // ドットの色：
  //   - 今日（黒背景）の上では白いドット
  //   - 今月以外（薄いグレーの数字）の上ではグレーのドット
  //   - 通常はメインカラーの濃いグレー
  // 「視覚的に主張しすぎない」がモノトーンの方針。
  const dotColor = !isCurrentMonth
    ? 'bg-gray-300'
    : isToday
    ? 'bg-white'
    : 'bg-gray-800'

  return (
    <button
      type="button"
      onClick={() => onSelect(dateKey)}
      aria-label={`${date.getMonth() + 1}月${date.getDate()}日${hasEntry ? '（記録あり）' : ''}`}
      className={classes.join(' ')}
    >
      {date.getDate()}

      {/*
        エントリーがある日にだけドットを描画。
          - absolute で数字レイアウトに干渉させない
          - bottom-1 で底辺から少し浮かす
          - 1.5 (= 6px) は小さいが、視覚ノイズを抑えつつ気付ける塩梅
      */}
      {hasEntry && (
        <span
          aria-hidden="true"
          className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${dotColor}`}
        />
      )}
    </button>
  )
}

export default CalendarDay
