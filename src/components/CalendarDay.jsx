/*
 * CalendarDay コンポーネント — カレンダーの 1 セル（1 日分）
 *
 * 役割:
 *   - 日付の数字を表示する
 *   - 「今日」「今月以外（先月末・翌月頭）」で見た目を変える
 *   - クリックされたら親に dateKey ("YYYY-MM-DD") を通知する
 *
 * 注意:
 *   - クリック後の挙動（モーダル表示など）は Issue #3 で実装する。
 *     今は親から渡される onSelect を呼ぶだけ。
 *
 * 設計のポイント（学習メモ）:
 *   - HTML の <button> をベースにしている。
 *     div + onClick でも動くが、button にしておくと:
 *       * キーボード（Enter/Space）で押せる
 *       * スクリーンリーダーに「ボタンです」と伝わる
 *       * フォーカスリングがブラウザ標準で出る
 *     アクセシビリティ的に常に正解。
 *
 *   - タップターゲットは aspect-square + 親グリッドの幅で 44px 以上を確保。
 *     スマホ幅 360px → 7 列 = 約 51px/列 になるので 44px 基準を満たす。
 */

function CalendarDay({ cell, onSelect }) {
  const { date, dateKey, isCurrentMonth, isToday } = cell

  // クラスを動的に組み立てるためのヘルパー。
  // 三項演算子を入れ子にすると読みにくいので、配列に push して join する書き方を採用。
  // 学習メモ: Tailwind のクラス結合は単純な文字列連結で OK（特別なライブラリ不要）。
  const classes = [
    // ベース：正方形のタップ領域、中央寄せ、押下時の控えめなアニメ
    'aspect-square flex items-center justify-center',
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

  return (
    <button
      type="button"
      onClick={() => onSelect(dateKey)}
      aria-label={`${date.getMonth() + 1}月${date.getDate()}日`}
      className={classes.join(' ')}
    >
      {date.getDate()}
    </button>
  )
}

export default CalendarDay
