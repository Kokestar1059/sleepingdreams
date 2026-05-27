/*
 * アプリのルートコンポーネント。
 *
 * 現時点（Phase 1 / Issue #1）の役割は最小限：
 *   - Vite + React + Tailwind v4 の配線が通っているかを画面で確認する
 *   - ベッドで片手スマホ操作する想定のミニマル/モノトーンな見た目の素振り
 *
 * 次の Issue から、ここに <Header /> や <Calendar /> を組み込んでいく。
 *
 * React の基本ルール（学習メモ）:
 *   - 関数コンポーネントは「JSX を return する関数」。
 *   - JSX のクラス指定は `class` ではなく `className` を使う（class は JS の予約語のため）。
 *   - Tailwind のユーティリティクラスを className に空白区切りで並べて見た目を作る。
 */
function App() {
  return (
    // 画面全体を覆うラッパー。
    //   min-h-screen : ビューポートの高さを最低限確保（中身が少なくても全画面）
    //   bg-gray-50   : CLAUDE.md の方針に従ったほぼ白の背景
    //   text-gray-900: 本文テキストはダークグレーで目に優しく
    //   flex + items-center + justify-center : 中身を縦横中央に
    //   px-6         : スマホでも端に張り付かない左右余白
    <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center px-6">
      {/* カード風のコンテナ。max-w-sm でスマホ幅基準にし、PC では中央寄せに見える */}
      <main className="w-full max-w-sm text-center">
        <p className="text-xs tracking-widest uppercase text-gray-400 mb-3">
          sleepingdreams
        </p>
        <h1 className="text-3xl font-semibold mb-4">
          Hello, dreams.
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          Vite + React + Tailwind v4 の配線確認用ページです。
          <br />
          ここから夢日記アプリを育てていきます。
        </p>
      </main>
    </div>
  )
}

export default App
