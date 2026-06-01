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
    // 原研哉トーン:
    //   rounded-md → rounded-none。グリッドの gap を 0 にしたので角丸を残すと
    //   セル同士の角丸が干渉して「パッチワーク状の隙間」に見える。角を消して格子を溶かす。
    'rounded-none text-sm select-none',
    // active:scale-95 → active:opacity-60。
    //   セルが縮むと密集した格子で隣と重なる感覚が出る。形を崩さずトーン（不透明度）だけで
    //   「押した」ことを伝えるほうが静か。transition も色変化に限定する。
    'transition-colors active:opacity-60',
    'hover:bg-gray-100',
  ]

  if (!isCurrentMonth) {
    // 先月末・翌月頭はグレーアウト。gray-300 → gray-200 に 1 段引いて、
    // 「存在は示すが主張しない」状態にする。
    classes.push('text-gray-200')
  } else if (isToday) {
    // 今日のハイライト。bg-gray-900 → bg-gray-800 に 1 段だけ明るく。
    //   純黒に近い強さは原研哉的な「静けさ」を壊すが、暗い部屋で今日を即座に見つける
    //   視認性も外せない。その接点が gray-800（黒に近いが純黒ではない）。
    classes.push('bg-gray-800 text-white hover:bg-gray-800')
  } else {
    // 通常の今月の日
    classes.push('text-gray-900')
  }

  // ドットの色（原研哉トーン: 「そっとそこにある記録」）:
  //   - 今日（濃い背景）の上では白いドットを少し和らげた white/70
  //   - 今月以外（薄いグレーの数字）の上では gray-200
  //   - 通常は gray-800 → gray-400 へ大きく引く。主張させず気配だけ残す
  const dotColor = !isCurrentMonth
    ? 'bg-gray-200'
    : isToday
    ? 'bg-white/70'
    : 'bg-gray-400'

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
          - w-2 h-2 (= 8px)：6px から拡大。暗い部屋・低輝度でも視認できる最小サイズ。
            色は gray-400 と薄めなので、サイズで「気配」を担保する設計。
      */}
      {hasEntry && (
        <span
          aria-hidden="true"
          className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${dotColor}`}
        />
      )}
    </button>
  )
}

export default CalendarDay
