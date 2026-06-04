/*
 * MicIcon — マイクアイコン（単色・ミニマル）
 *
 *   原研哉トーンに合わせ、線だけの静かなアイコンにする。
 *   stroke="currentColor" を使うことで、親要素の文字色（gray-400 / white など）を
 *   そのまま継承する。色をアイコン側に持たせないことで、置く場所に応じて自然に馴染む。
 *
 *   音声入力ボタン（EntryModal のフォーム内）と、カレンダー下のクイック音声 FAB
 *   （Calendar）の両方で使うので、独立コンポーネントに切り出して重複を避ける。
 *
 *   aria-hidden: 意味は使う側のボタンの aria-label が伝えるので、
 *                アイコン自体は読み上げ対象から外す。
 *
 * @param {Object} props
 * @param {number} [props.size=14] 一辺のピクセル数。FAB ではやや大きめ(22)で使う。
 */
function MicIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* マイク本体（縦長の丸） */}
      <rect x="9" y="2" width="6" height="11" rx="3" />
      {/* マイクを支える受け皿（U字） */}
      <path d="M5 10a7 7 0 0 0 14 0" />
      {/* スタンドの縦棒 */}
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

export default MicIcon
