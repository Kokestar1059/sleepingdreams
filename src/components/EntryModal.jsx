/*
 * EntryModal — 日付タップで開くモーダル
 *
 * 役割:
 *   - 選択された日付に紐づくエントリー一覧を出す
 *   - 「新規追加」ボタンでフォーム画面に切り替える
 *   - エントリーをタップすると編集フォームに切り替える
 *   - 保存 / 削除 / キャンセル操作
 *
 * 設計のポイント（学習メモ）:
 *
 * 1) モーダルの「画面」を内部 state で切り替える
 *    - view = 'list' | 'form' の 2 値を useState で持つだけ。
 *    - ルーティングライブラリを使わずに済む小さな状態機械。
 *    - 「閉じて開き直したらリセットしたい」という要件は、
 *      親側でモーダルを毎回マウント／アンマウントすることで自然に達成する。
 *      （Calendar 側で selectedDateKey が null のときは EntryModal を描画しない）
 *      こうすると useEffect で内部 state をリセットする必要がなく、
 *      「props 変化 → setState」の anti-pattern を回避できる。
 *
 * 2) フォームは「制御コンポーネント」で書く
 *    - <input value={title} onChange={...}/> のように、入力値を React の state で握る。
 *    - これにより「state こそが真実の値」になり、保存時の値ズレが起きない。
 *
 * 3) モーダルの実装方針
 *    - <dialog> 要素は便利だが iOS Safari の挙動・スタイリング自由度に難があるため、
 *      自前で fixed + 背景オーバーレイで作る。
 *    - レイアウトは「画面中央に浮かぶカード + 背景ブラー（スクリム）」。
 *      寝ぼけた状態でも一望性が高く、背景がブラーで後退するので入力に集中できる。
 *    - 背景クリックで閉じる：オーバーレイ自身のクリックでのみ閉じ、
 *      e.target === e.currentTarget で「子からのバブリングではない」ことを確認する。
 *    - Esc キーで閉じるのは UX として欲しいので useEffect で keydown を貼る。
 *
 * 4) スクロールロック
 *    - モーダル表示中に body のスクロールを止めると見栄えが良い。
 *      open のときだけ body.style.overflow = 'hidden' に。
 *
 * 5) 日付の表示
 *    - dateKey は "YYYY-MM-DD" 文字列。
 *      モーダルのタイトルでは「5月26日」のように見せたいので、文字列分解で対応する。
 *      （Date オブジェクトに戻すとタイムゾーンずれの可能性があるため避ける）
 */

import { useEffect, useState } from 'react'

/**
 * @param {Object} props
 * @param {string}  props.dateKey               選択中の日付 ("YYYY-MM-DD")
 * @param {Array}   props.entries               その日のエントリー配列
 * @param {Function} props.onClose              モーダルを閉じる
 * @param {Function} props.onCreate             ({ entryDate, title, body }) を渡すと新規作成
 * @param {Function} props.onUpdate             (id, { title, body }) で更新
 * @param {Function} props.onDelete             (id) で削除
 *
 * 注意:
 *   - このコンポーネントは「モーダルが開いている間だけ」マウントされる前提。
 *     親（Calendar）で `selectedDateKey !== null` のときだけ描画する。
 *     こうすると閉→開のたびに内部 state が自動でリセットされる。
 */
function EntryModal({ dateKey, entries, onClose, onCreate, onUpdate, onDelete }) {
  // モーダル内の表示モード： 'list' は一覧、'form' は作成/編集フォーム
  const [view, setView] = useState('list')
  // 編集中のエントリー。null なら新規作成モード。
  const [editingEntry, setEditingEntry] = useState(null)
  // フォームの入力値（制御コンポーネント）
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  // Esc キーで閉じる。
  // 学習メモ:
  //   - effect の中で addEventListener したら、必ず cleanup で remove する。
  //   - そうしないと多重発火＆メモリリークになる。
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // モーダル表示中は背景スクロールを止める。
  // マウント時に書き換え、アンマウント時に復元する。
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ---- イベントハンドラ ----------------------------------------------------

  // オーバーレイのクリックで閉じる（子要素クリックのバブリングは無視）
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  // 「新規追加」ボタン
  const handleClickCreate = () => {
    setEditingEntry(null)
    setTitle('')
    setBody('')
    setView('form')
  }

  // 一覧のエントリーをタップ → 編集モード
  const handleClickEdit = (entry) => {
    setEditingEntry(entry)
    setTitle(entry.title)
    setBody(entry.body)
    setView('form')
  }

  // フォーム保存
  const handleSubmit = (e) => {
    e.preventDefault()
    // タイトル・本文の両方が空ならスキップ（誤タップ保護）
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    if (!trimmedTitle && !trimmedBody) return

    if (editingEntry) {
      onUpdate(editingEntry.id, { title: trimmedTitle, body: trimmedBody })
    } else {
      onCreate({ entryDate: dateKey, title: trimmedTitle, body: trimmedBody })
    }
    // 保存したら一覧に戻る（モーダルは閉じない＝続けて他のエントリーを編集できる）
    setView('list')
    setEditingEntry(null)
    setTitle('')
    setBody('')
  }

  // フォーム上での削除（編集中エントリーがある場合のみ）
  const handleDelete = () => {
    if (!editingEntry) return
    // 学習メモ:
    //   window.confirm はブラウザ標準のダイアログ。
    //   Phase 1 では十分。Phase 2 以降で見た目を整えたい場合は自前のカスタムダイアログに置換する。
    const ok = window.confirm('このエントリーを削除しますか？')
    if (!ok) return
    onDelete(editingEntry.id)
    setView('list')
    setEditingEntry(null)
  }

  // ---- 表示用ヘルパ --------------------------------------------------------

  // "2026-05-26" → "2026年5月26日" の見出しを文字列分解で作る。
  // Date オブジェクトを介さないことでタイムゾーン事故を防ぐ。
  const formatHeading = (key) => {
    const [y, m, d] = key.split('-')
    return `${y}年${Number(m)}月${Number(d)}日`
  }

  return (
    // オーバーレイ：画面全体を覆う半透明レイヤー + 背景ブラー（スクリム）
    //   - backdrop-blur-sm : 背景のカレンダーを軽くぼかして「裏は触れない」感を出す
    //   - bg-black/40      : 半透明の黒で全体を一段暗くしてダイアログを浮き立たせる
    //   - items-center     : 画面中央にダイアログを配置（全端末共通）
    //   - p-4              : 端末端からのマージン。狭い画面でもダイアログが端に張り付かない
    <div
      onClick={handleOverlayClick}
      className="
        fixed inset-0 z-50
        bg-black/40 backdrop-blur-sm
        flex items-center justify-center
        p-4
      "
      // role / aria はモーダルらしさをスクリーンリーダーに伝えるためのおまじない
      role="dialog"
      aria-modal="true"
      aria-label={`${formatHeading(dateKey)} の夢日記`}
    >
      {/*
        モーダル本体（ダイアログカード）。
          - 全端末で中央配置・全周角丸の "カード" として描画する
          - max-h-[85vh] でビューポートに収め、内部スクロールで溢れを吸収
          - shadow-xl で背景から浮かせる
      */}
      <div
        className="
          w-full max-w-md
          bg-white
          rounded-2xl
          shadow-xl
          max-h-[85vh] flex flex-col
        "
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">
            {formatHeading(dateKey)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="
              h-9 w-9 flex items-center justify-center
              rounded-full text-gray-600
              hover:bg-gray-100 active:scale-95 transition
            "
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* 中身：view によって出すコンテンツを切り替える */}
        {view === 'list' ? (
          <ListView
            entries={entries}
            onClickCreate={handleClickCreate}
            onClickEdit={handleClickEdit}
          />
        ) : (
          <FormView
            isEditing={Boolean(editingEntry)}
            title={title}
            body={body}
            onChangeTitle={setTitle}
            onChangeBody={setBody}
            onSubmit={handleSubmit}
            onCancel={() => setView('list')}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  )
}

/*
 * 一覧ビュー（list モード）
 * - その日のエントリーを縦に並べる
 * - 0 件のときは空状態メッセージ
 * - 下部に「+ 新規追加」ボタン（タップターゲット大きめ）
 *
 * 別関数に切り出した理由:
 *   - EntryModal 本体が長くなりすぎるため
 *   - props で必要なものだけ受け取るシンプルな表示用コンポーネントなので
 *     state を持たない（プレゼンテーショナル）
 */
function ListView({ entries, onClickCreate, onClickEdit }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {entries.length === 0 ? (
          // 空状態
          <p className="text-sm text-gray-500 text-center py-8">
            この日の記録はまだありません
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onClickEdit(entry)}
                  className="
                    w-full text-left
                    px-3 py-3
                    rounded-lg border border-gray-200
                    hover:bg-gray-50 active:scale-[0.99] transition
                  "
                >
                  {/*
                    タイトル：未入力なら "(無題)" と出す。
                    本文：1 行プレビュー（line-clamp-1）で簡潔に。
                  */}
                  <div className="text-sm font-medium text-gray-900">
                    {entry.title || '(無題)'}
                  </div>
                  {entry.body && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {entry.body}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* フッター：新規追加ボタン */}
      <div className="px-4 py-3 border-t border-gray-200">
        <button
          type="button"
          onClick={onClickCreate}
          className="
            w-full h-12
            rounded-lg
            bg-gray-900 text-white text-sm font-medium
            hover:bg-gray-800 active:scale-[0.99] transition
          "
        >
          + 新規追加
        </button>
      </div>
    </>
  )
}

/*
 * フォームビュー（form モード）
 * - 新規作成・編集の両方を担う（isEditing で見出しと削除ボタンの有無を切り替え）
 *
 * 制御コンポーネントの形:
 *   - value と onChange を親（EntryModal）から受け取り、入力のたびに上に通知する。
 *   - こうすると親が「現在のフォームの値」を常に把握できる。
 */
function FormView({
  isEditing,
  title,
  body,
  onChangeTitle,
  onChangeBody,
  onSubmit,
  onCancel,
  onDelete,
}) {
  return (
    <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div>
          <label htmlFor="entry-title" className="block text-xs text-gray-500 mb-1">
            タイトル
          </label>
          <input
            id="entry-title"
            type="text"
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="例: 空を飛ぶ夢"
            className="
              w-full h-11 px-3
              rounded-lg border border-gray-300
              text-sm text-gray-900
              focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900
            "
          />
        </div>

        <div>
          <label htmlFor="entry-body" className="block text-xs text-gray-500 mb-1">
            内容
          </label>
          <textarea
            id="entry-body"
            value={body}
            onChange={(e) => onChangeBody(e.target.value)}
            placeholder="夢の内容をメモ..."
            rows={8}
            className="
              w-full px-3 py-2
              rounded-lg border border-gray-300
              text-sm text-gray-900
              resize-none
              focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900
            "
          />
        </div>

        {/* 編集モードのみ「削除」ボタンを出す */}
        {isEditing && (
          <button
            type="button"
            onClick={onDelete}
            className="
              w-full h-11
              rounded-lg
              border border-red-200 text-red-600 text-sm
              hover:bg-red-50 active:scale-[0.99] transition
            "
          >
            このエントリーを削除
          </button>
        )}
      </div>

      {/* フッター：キャンセル / 保存 */}
      <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="
            flex-1 h-12
            rounded-lg
            border border-gray-300 text-gray-700 text-sm font-medium
            hover:bg-gray-50 active:scale-[0.99] transition
          "
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="
            flex-1 h-12
            rounded-lg
            bg-gray-900 text-white text-sm font-medium
            hover:bg-gray-800 active:scale-[0.99] transition
          "
        >
          {isEditing ? '更新' : '保存'}
        </button>
      </div>
    </form>
  )
}

export default EntryModal
