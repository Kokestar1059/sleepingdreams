/*
 * Header コンポーネント — 月ナビゲーション（< 2026年5月 >）
 *
 * 役割:
 *   - 表示中の月を真ん中に出す
 *   - 左右の矢印ボタンで前月・翌月へ遷移する
 *
 * 設計のポイント（学習メモ）:
 *   - このコンポーネントは「状態を持たない」（= プレゼンテーショナルコンポーネント）。
 *     現在表示中の月の状態は親（Calendar）が useState で持ち、
 *     Header はそれを props で受け取って表示し、ボタンが押されたら
 *     親の更新関数（onPrev / onNext）を呼ぶだけ。
 *     こうすると「状態は 1 箇所に集約・子はイベントを上に通知」という
 *     React の基本パターン（lifting state up）が綺麗に表れる。
 *
 *   - Props を分割代入で受け取る（CLAUDE.md のコーディング規約）。
 *
 *   - ボタンの最小タップ領域は 44×44px（iOS HIG）。
 *     Tailwind で h-11 w-11（= 2.75rem = 44px）を確保。
 */

import { formatYearMonth } from '../utils/dateUtils'

function Header({ currentMonth, onPrev, onNext }) {
  return (
    <header className="flex items-center justify-between mb-4">
      {/*
        前月ボタン
          - aria-label : スクリーンリーダー用に役割を明示
          - active:scale-95 : 押下時に少しだけ縮めて押した感を出す（控えめなアニメ）
          - hover:bg-gray-100 : デスクトップ向けのホバー演出
      */}
      <button
        type="button"
        onClick={onPrev}
        aria-label="前の月"
        className="
          h-11 w-11 flex items-center justify-center
          rounded-full text-gray-900
          hover:bg-gray-100 active:scale-95
          transition
        "
      >
        {/* シンプルな < 記号。アイコンライブラリは入れず、文字で表現する */}
        <span className="text-xl leading-none">‹</span>
      </button>

      {/* 中央：現在表示中の月見出し */}
      <h2 className="text-lg font-semibold tracking-wide text-gray-900">
        {formatYearMonth(currentMonth)}
      </h2>

      {/* 翌月ボタン */}
      <button
        type="button"
        onClick={onNext}
        aria-label="次の月"
        className="
          h-11 w-11 flex items-center justify-center
          rounded-full text-gray-900
          hover:bg-gray-100 active:scale-95
          transition
        "
      >
        <span className="text-xl leading-none">›</span>
      </button>
    </header>
  )
}

export default Header
