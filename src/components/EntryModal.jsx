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
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'

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
    const ok = window.confirm('このメモを消しますか？')
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
    //   原研哉トーン: 背景を遮断しすぎず、少しだけ気配を残す。
    //   - backdrop-blur-[2px] : ブラーを 4px→2px に弱め、裏のカレンダーがうっすら見える
    //   - bg-black/30         : スクリムも 40%→30% に薄め、「夢の記録中も自分はカレンダーの上にいる」連続感
    //   - items-center        : 画面中央にダイアログを配置（全端末共通）
    //   - p-5                 : 端末端からのマージン(16px→20px)。カードが端に張り付かない
    //   - animate-[overlayIn...] : index.css の @keyframes でフェードイン
    <div
      onClick={handleOverlayClick}
      className="
        fixed inset-0 z-50
        bg-black/30 backdrop-blur-[2px]
        flex items-center justify-center
        p-5
        animate-[overlayIn_200ms_ease-out]
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
          - shadow は shadow-xl(濃い影)をやめ、淡く広い影に。
            rgba(0,0,0,0.08) で 40px ぼかすと「空気の上に浮いた紙」感になる（原研哉トーン）。
          - animate-[cardIn...] : 10px 下からふわっと持ち上げる（index.css 定義）
      */}
      <div
        className="
          w-full max-w-md
          bg-white
          rounded-2xl
          shadow-[0_8px_40px_rgba(0,0,0,0.08)]
          max-h-[85vh] flex flex-col
          animate-[cardIn_200ms_ease-out]
        "
      >
        {/*
          ヘッダー
            原研哉トーン: 日付は「記録がある場所の座標（標識）」であり主役ではない。
            text-base font-semibold gray-900（主張する見出し）から
            text-sm font-normal tracking gray-400（そっとある標識）に降格させ、
            主役を一覧のエントリータイトルに譲る。余白も px-4 py-3 → px-6 py-5 に広げる。
            ボーダーは gray-200 → gray-100 に引いて線を消す。
        */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-sm font-normal tracking-[0.08em] text-gray-400">
            {formatHeading(dateKey)}
          </h3>
          {/*
            タップターゲットは 44×44px 以上（CLAUDE.md「UI・デザイン方針」）に従う。
            Tailwind の h-11 w-11 = 44px。寝起きの片手スマホ操作で押し外しを防ぐ。
          */}
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="
              h-11 w-11 flex items-center justify-center
              rounded-full
              hover:bg-gray-100 active:opacity-60 transition-colors
            "
          >
            {/*
              閉じるボタンは「使えるが主張しない」存在に。
              アイコンの色をボタンではなく子要素の span で text-gray-300 に指定することで、
              通常時は薄く、hover:bg-gray-100 の反応は保つ。
            */}
            <span className="text-xl leading-none text-gray-300">×</span>
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
      {/* 一覧エリア。余白を px-4 py-3 → px-6 py-4 に広げて呼吸させる */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {entries.length === 0 ? (
          // 空状態。
          //   原研哉の「白の余白は空っぽではなく、これから満たされる器」を実装する。
          //   py-8 → py-12 と余白を広げ、text-gray-500 → gray-300 と引くことで
          //   メッセージ自体も静かに佇ませる。
          <p className="text-sm text-gray-300 text-center py-12 tracking-[0.04em]">
            この日の記録はまだありません
          </p>
        ) : (
          // 行間 space-y-2 → space-y-3。1 件ずつが独立した記憶として見える
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onClickEdit(entry)}
                  className="
                    w-full text-left
                    px-4 py-4
                    rounded-xl border border-gray-100
                    hover:bg-gray-50 active:opacity-60 transition-colors
                  "
                >
                  {/*
                    タイトル：未入力なら "(無題)" と出す。font-medium → font-normal。
                      日本語 font-normal は十分読めるので medium の主張を抜く。
                    本文：1 行プレビュー（line-clamp-1）。gray-500 → gray-400、mt-1 → mt-1.5。
                      タイトルとの間に階層を作り、夢の記憶らしく薄く添える。
                  */}
                  <div className="text-sm font-normal text-gray-900">
                    {entry.title || '(無題)'}
                  </div>
                  {entry.body && (
                    <div className="text-xs text-gray-400 tracking-[0.02em] mt-1.5 line-clamp-1">
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
      <div className="px-6 py-4 border-t border-gray-100">
        {/*
          このアプリで最も多く押すボタン。寝起きの片手で迷わずタップできるよう
          h-12 → h-14 (48px→56px) に拡大。font-medium → font-normal + 字間で
          「命令」ではなく「案内」のトーンに。
        */}
        <button
          type="button"
          onClick={onClickCreate}
          className="
            w-full h-14
            rounded-xl
            bg-gray-900 text-white text-sm font-normal tracking-[0.06em]
            hover:bg-gray-800 active:opacity-80 transition-colors
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
  // 音声認識フック。確定文（final）が来るたびに onResult が呼ばれる。
  //   onChangeBody は親の setBody そのものなので、更新関数 (prev => ...) を渡せる。
  //   こうすると「直前の本文」を確実に受け取れる（非同期で何度も追記しても取りこぼさない）。
  //   日本語は単語間にスペースを入れないので、確定文はそのまま連結する。
  const {
    isSupported: isSpeechSupported,
    isListening,
    interimTranscript,
    error: speechError,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition({
    lang: 'ja-JP',
    onResult: (chunk) => {
      const text = chunk.trim()
      if (!text) return
      onChangeBody((prev) => (prev ? prev + text : text))
    },
  })

  // マイクボタンのタップ: 聞き取り中なら止める、そうでなければ始める（トグル）。
  const handleToggleMic = () => {
    if (isListening) stopListening()
    else startListening()
  }

  // エラー表示の文言を決める。'no-speech'(無音) や 'aborted'(中断) は
  //   日常的に起きるので黙殺し、ユーザーが対処できるものだけ言葉にする。
  const speechErrorMessage =
    speechError === 'not-allowed' || speechError === 'service-not-allowed'
      ? 'マイクの使用が許可されていません'
      : speechError && speechError !== 'no-speech' && speechError !== 'aborted'
        ? '音声をうまく認識できませんでした'
        : null

  return (
    <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
      {/* 入力エリア。余白 px-4 py-3 space-y-3 → px-6 py-5 space-y-4 でゆったりさせる */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div>
          {/* ラベルは案内板。gray-500 → gray-400 + 字間、mb-1 → mb-2 で入力欄から独立させる */}
          <label htmlFor="entry-title" className="block text-xs text-gray-400 tracking-[0.06em] mb-2">
            タイトル
          </label>
          <input
            id="entry-title"
            type="text"
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="例: 空を飛ぶ夢"
            className="
              w-full h-11 px-4
              rounded-xl border border-gray-100
              text-base text-gray-900
              focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-400
            "
          />
        </div>

        <div>
          {/*
            ラベル行: 左にラベル「内容」、右に音声入力ボタン。
              非対応ブラウザ（isSpeechSupported=false）ではボタン自体を出さない。
              出しても押せないものを見せると寝ぼけた指が迷うため、存在ごと消すのが親切。
          */}
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="entry-body" className="block text-xs text-gray-400 tracking-[0.06em]">
              内容
            </label>
            {isSpeechSupported && (
              <button
                type="button"
                onClick={handleToggleMic}
                aria-label={isListening ? '音声入力を止める' : '音声入力を始める'}
                aria-pressed={isListening}
                className={`
                  h-11 px-3 -my-1
                  inline-flex items-center gap-1.5
                  rounded-full text-xs tracking-[0.04em]
                  transition-colors
                  ${
                    isListening
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-400 hover:bg-gray-50 active:opacity-60'
                  }
                `}
              >
                {/*
                  アイコンは原研哉トーンに合わせ単色のミニマルなマイク。
                    聞き取り中は「●（録音中）」を点滅させ、テキストも「停止」に変える。
                    点滅は Tailwind 標準ユーティリティ animate-pulse（ゆっくり明滅）で控えめに。
                */}
                {isListening ? (
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" aria-hidden="true" />
                ) : (
                  <MicIcon />
                )}
                {isListening ? '停止' : '音声'}
              </button>
            )}
          </div>
          {/*
            夢の内容を書く欄は「入力フォーム」ではなく「日記のページ」として体験させたい。
              - text-sm → text-base leading-relaxed: 16px + ゆったり行間で寝起きでも読みやすい
              - rows={8} → {6}: 画面の大半を占めないようにし、フッターのボタンが見える余裕を残す
              - focus リングは ring-2(太い) → ring-1 gray-300(細い): 「叫ばず静かに示す」
          */}
          <textarea
            id="entry-body"
            value={body}
            onChange={(e) => onChangeBody(e.target.value)}
            placeholder="夢の内容をメモ..."
            rows={6}
            className="
              w-full px-4 py-3
              rounded-xl border border-gray-100
              text-base leading-relaxed text-gray-900
              resize-none
              focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-400
            "
          />

          {/*
            音声入力のフィードバック行（高さ固定で出し入れしてもレイアウトが跳ねないように）。
              優先順位: エラー > 途中経過 > 聞き取り中の案内。
              - 確定文は textarea に既に入っているので、ここには「未確定の途中経過」だけ出す。
              - iOS Safari は途中経過が来ないことがあるので、その時は「聞き取り中…」を出す。
          */}
          <div className="mt-2 min-h-[1.25rem] text-xs tracking-[0.02em]">
            {speechErrorMessage ? (
              <span className="text-red-300">{speechErrorMessage}</span>
            ) : isListening ? (
              <span className="text-gray-400">
                {interimTranscript || '聞き取り中…'}
              </span>
            ) : null}
          </div>
        </div>

        {/*
          編集モードのみ「削除」ボタンを出す。
            破壊的アクションは強調しない。ボーダー付きボタン → テキストのみに変え、
            red-600 → red-300 と薄くして「あえて見つけにいく」操作にする（誤タップ抑制）。
            ただし高さは h-11(44px) を維持：誤タップ抑制は「色を薄く・テキストのみ」で達成し、
            タップ領域は iOS HIG の最低 44px を割らない（CLAUDE.md のタップターゲット規約）。
        */}
        {isEditing && (
          <button
            type="button"
            onClick={onDelete}
            className="
              w-full h-11 text-xs text-red-300
              hover:text-red-400 active:opacity-60 transition-colors
            "
          >
            このメモを消す
          </button>
        )}
      </div>

      {/*
        フッター：キャンセル / 保存
          キャンセルは「破棄の宣言」ではなく「戻るだけ」。text-gray-700 → gray-400 と
          主張を抑えることで、保存ボタン（黒）との重みの差が自然に生まれる。
          高さは h-12 → h-14 で寝起きでもタップしやすく。
      */}
      <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="
            flex-1 h-14
            rounded-xl
            border border-gray-200 text-gray-400 text-sm font-normal
            hover:bg-gray-50 active:opacity-60 transition-colors
          "
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="
            flex-1 h-14
            rounded-xl
            bg-gray-900 text-white text-sm font-normal tracking-[0.04em]
            hover:bg-gray-800 active:opacity-80 transition-colors
          "
        >
          {isEditing ? '更新' : '保存'}
        </button>
      </div>
    </form>
  )
}

/*
 * MicIcon — 音声入力ボタンのマイクアイコン（単色・ミニマル）
 *   原研哉トーンに合わせ、線だけの静かなアイコンにする。
 *   currentColor を使うことで、親ボタンの文字色（gray-400 / white）をそのまま継承する。
 *   aria-hidden: 意味はボタンの aria-label が伝えるので、アイコンは読み上げ対象外にする。
 */
function MicIcon() {
  return (
    <svg
      width="14"
      height="14"
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

export default EntryModal
