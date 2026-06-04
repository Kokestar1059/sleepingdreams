/*
 * useSpeechRecognition — Web Speech API（音声認識）をまとめたカスタムフック
 *
 * 役割:
 *   - ブラウザ標準の SpeechRecognition を扱いやすい形にラップする
 *   - 「対応しているか / 今聞き取り中か / 途中経過テキスト / エラー」を state で公開
 *   - start() / stop() で開始・停止できるようにする
 *   - 確定したテキスト（final）が出るたびに onResult(chunk) で親へ渡す
 *
 * ■ なぜカスタムフックに切り出すか（学習メモ）
 *   音声認識は「インスタンス生成 → 設定 → イベント購読 → 後始末」と手順が多い。
 *   これを EntryModal の中に直接書くと、UI のコードと混ざって読みづらくなる。
 *   「ロジックはフック、見た目はコンポーネント」と分けると、両方が短く読みやすくなる。
 *   （useEntries.js が CRUD を引き受けているのと同じ考え方）
 *
 * ■ iOS Safari 対策（ここが今回の肝）
 *   1) ベンダープレフィックス:
 *      Web Speech API はまだ標準化の途中で、Chrome/Safari は
 *      `webkitSpeechRecognition` という接頭辞付きの名前で実装している。
 *      だから window.SpeechRecognition と window.webkitSpeechRecognition の
 *      両方を見て、使える方を採用する。
 *   2) interimResults（途中経過）は不安定:
 *      iOS Safari では途中経過がうまく出ないことがある。なので
 *      「途中経過は画面下にうっすら出すだけ」「本文に書き込むのは確定文だけ」にして、
 *      途中経過が来なくても困らない設計にする。
 *   3) 連続モード + 自前の無音タイマーで「小休止では切らない」:
 *      continuous=false だと一区切りの無音で即終了してしまい、考えながら話すと切れる。
 *      そこで continuous=true にして小休止では切らず、代わりに「結果が一定時間
 *      （silenceTimeoutMs）来なかったら自分から stop()」する無音タイマーを持つ。
 *      これで「話している間は継続・数秒黙ったら自動停止」になり、continuous=true の
 *      弱点（マイクが開きっぱなし）も無音タイマーが閉じるので塞げる。
 *      自動リスタート（onend で勝手に start し直す）はしない＝iOS で不安定なため。
 *   4) オフライン不可:
 *      Chrome/Safari の音声認識はサーバー処理。オフラインでは動かない（仕様）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ブラウザが提供する SpeechRecognition クラスを取得する。
// 標準名（SpeechRecognition）が無ければ webkit 接頭辞版にフォールバックする。
// window が無い環境（SSR 等）でも壊れないよう typeof でガードしておく。
const SpeechRecognitionClass =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined

// このブラウザで音声認識が使えるか。フックを呼ばずに「対応しているか」だけ
// 知りたい場面（例: Calendar が音声 FAB を出すか決める）で import して使う。
export const isSpeechRecognitionSupported = Boolean(SpeechRecognitionClass)

/**
 * @param {Object}   [options]
 * @param {string}   [options.lang='ja-JP']           認識する言語
 * @param {number}   [options.silenceTimeoutMs=2000]  この時間だけ結果が来なければ自動停止する（無音タイマー）
 * @param {boolean}  [options.autoStart=false]        true なら認識インスタンスが用意でき次第すぐ聞き取りを始める
 * @param {Function} [options.onResult]               確定テキスト（final）が出るたびに呼ばれる (chunk: string) => void
 * @returns {{
 *   isSupported: boolean,        このブラウザで音声認識が使えるか
 *   isListening: boolean,        今マイクが聞き取り中か
 *   interimTranscript: string,   まだ確定していない途中経過テキスト
 *   error: string | null,        直近のエラー種別（SpeechRecognitionErrorEvent.error）
 *   start: () => void,           聞き取り開始
 *   stop: () => void,            聞き取り停止
 * }}
 */
export function useSpeechRecognition({
  lang = 'ja-JP',
  silenceTimeoutMs = 2000,
  autoStart = false,
  onResult,
} = {}) {
  // クラスが取れたかどうか＝このブラウザで使えるか。レンダーをまたいで一定なので state 不要。
  const isSupported = isSpeechRecognitionSupported

  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState(null)

  // SpeechRecognition インスタンスは再レンダーのたびに作り直したくない。
  // ref に入れておけば、コンポーネントが再描画されても同じインスタンスを使い続けられる。
  const recognitionRef = useRef(null)

  // onResult は親が毎レンダー新しい関数を渡してくる可能性がある（アロー関数なので）。
  // それをイベントリスナーに直接渡すと、毎回貼り替えが必要になってしまう。
  // そこで「最新の onResult」を ref に逃がしておき、リスナー内からは ref 経由で呼ぶ。
  // こうするとリスナーは一度だけ貼れば済み、かつ常に最新のコールバックを呼べる。
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  // ---- インスタンス生成とイベント購読（マウント時に一度だけ）----------------
  useEffect(() => {
    // 非対応ブラウザでは何もしない（ボタン側も出さない想定）。
    if (!isSupported) return

    const recognition = new SpeechRecognitionClass()

    // continuous=true: 小休止では切らず聞き続ける（考えながら話しても途切れない）。
    //   代わりに下の「無音タイマー」で、結果が一定時間来なければ自分から止める。
    recognition.continuous = true
    // interimResults=true: 途中経過も受け取る（iOS では出ないこともあるが害はない）。
    recognition.interimResults = true
    recognition.lang = lang

    // 無音タイマーの id を持つ箱。setTimeout の戻り値をしまっておき、後で clear する。
    let silenceTimer = null
    const clearSilenceTimer = () => {
      if (silenceTimer !== null) {
        clearTimeout(silenceTimer)
        silenceTimer = null
      }
    }
    // タイマーを張り直す（結果が来るたびに呼ぶ）。
    //   silenceTimeoutMs の間ずっと新しい結果が来なければ＝沈黙とみなして stop()。
    //   stop() は「今までの認識を確定してから」終わるので、言いかけも取りこぼさない。
    const armSilenceTimer = () => {
      clearSilenceTimer()
      silenceTimer = setTimeout(() => {
        recognition.stop()
      }, silenceTimeoutMs)
    }

    // 認識結果が届くたびに呼ばれる。
    //   event.results は「これまでの認識結果の配列」。
    //   event.resultIndex から後ろだけ見れば、今回新しく増えた分を処理できる。
    recognition.onresult = (event) => {
      // 何か聞こえている＝まだ喋っている、とみなして無音タイマーをリセット。
      armSilenceTimer()
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript
        if (result.isFinal) {
          // 確定文だけを親へ渡す（本文への書き込みは親が担当）。
          onResultRef.current?.(text)
        } else {
          // まだ確定していない分は途中経過として溜める。
          interim += text
        }
      }
      setInterimTranscript(interim)
    }

    // 開始時。エラー表示をクリアし、聞き取り中フラグを立てる。
    //   開始直後に何も喋らないケースに備え、ここでも無音タイマーを張っておく。
    recognition.onstart = () => {
      setError(null)
      setIsListening(true)
      armSilenceTimer()
    }

    // 終了時（自動停止・stop() 呼び出し・エラー後など、必ず最後に呼ばれる）。
    //   ここで状態を片付けるのが一番確実。タイマーも途中経過も消す。
    recognition.onend = () => {
      clearSilenceTimer()
      setIsListening(false)
      setInterimTranscript('')
    }

    // エラー時。種別だけ控える。'no-speech'(無音) や 'aborted'(中断) は
    //   日常的に起きるので、表示側で「うるさく出さない」よう扱いを分ける。
    recognition.onerror = (event) => {
      setError(event.error)
    }

    recognitionRef.current = recognition

    // autoStart: 「今まさに生成した、生きているインスタンス」に対してすぐ開始する。
    //   ここで始めるのが肝。React の StrictMode（開発時）は effect を
    //   「実行 → 破棄 → 再実行」するので、破棄で前のインスタンスは abort される。
    //   開始処理を effect の外（別の effect やマウント1回ガード）に置くと、
    //   「abort 済みの古いインスタンスを開始してしまい、生きてる方は開始されない」事故が起きる。
    //   生成と同じ effect 内で始めれば、再実行のたびに「新しい生きたインスタンス」を開始でき、
    //   StrictMode でも本番でも確実に録音が立ち上がる。
    if (autoStart) {
      try {
        recognition.start()
      } catch {
        // 直前のインスタンスがまだ完全に終わっていない等で稀に InvalidStateError。
        // onend/onstart で状態は整うので握りつぶす。
      }
    }

    // 後始末: コンポーネントが消える（モーダルを閉じる等）ときに認識を止める。
    //   abort() は結果を捨てて即停止。タイマーとリスナーも明示的に外して取りこぼしを防ぐ。
    return () => {
      clearSilenceTimer()
      recognition.onresult = null
      recognition.onstart = null
      recognition.onend = null
      recognition.onerror = null
      recognition.abort()
      recognitionRef.current = null
    }
    // lang / silenceTimeoutMs / autoStart を変えたら作り直す。isSupported は実行中に変わらない。
  }, [isSupported, lang, silenceTimeoutMs, autoStart])

  // ---- 公開する操作 --------------------------------------------------------

  const start = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition || isListening) return
    try {
      recognition.start()
    } catch {
      // すでに start 済みの状態で再度 start すると InvalidStateError が飛ぶ。
      // 二重押し対策はしているが、保険として握りつぶす（onend で状態は整う）。
    }
  }, [isListening])

  const stop = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    // stop() は「今までの認識を確定させてから」終わる（abort と違い結果を残す）。
    recognition.stop()
  }, [])

  return { isSupported, isListening, interimTranscript, error, start, stop }
}
