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
 *   3) 連続モードの自動リスタートはしない:
 *      continuous=true で放置するとマイクが開きっぱなしになり、iOS では特に不安定。
 *      無音で自動停止したら「もう一度タップして再開」してもらう方が壊れにくい。
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

/**
 * @param {Object}   [options]
 * @param {string}   [options.lang='ja-JP'] 認識する言語
 * @param {Function} [options.onResult]     確定テキスト（final）が出るたびに呼ばれる (chunk: string) => void
 * @returns {{
 *   isSupported: boolean,        このブラウザで音声認識が使えるか
 *   isListening: boolean,        今マイクが聞き取り中か
 *   interimTranscript: string,   まだ確定していない途中経過テキスト
 *   error: string | null,        直近のエラー種別（SpeechRecognitionErrorEvent.error）
 *   start: () => void,           聞き取り開始
 *   stop: () => void,            聞き取り停止
 * }}
 */
export function useSpeechRecognition({ lang = 'ja-JP', onResult } = {}) {
  // クラスが取れたかどうか＝このブラウザで使えるか。レンダーをまたいで一定なので state 不要。
  const isSupported = Boolean(SpeechRecognitionClass)

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

    // continuous=false: 一区切り喋って無音になったら自動で止まる（iOS で壊れにくい）。
    recognition.continuous = false
    // interimResults=true: 途中経過も受け取る（iOS では出ないこともあるが害はない）。
    recognition.interimResults = true
    recognition.lang = lang

    // 認識結果が届くたびに呼ばれる。
    //   event.results は「これまでの認識結果の配列」。
    //   event.resultIndex から後ろだけ見れば、今回新しく増えた分を処理できる。
    recognition.onresult = (event) => {
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
    recognition.onstart = () => {
      setError(null)
      setIsListening(true)
    }

    // 終了時（自動停止・stop() 呼び出し・エラー後など、必ず最後に呼ばれる）。
    //   ここで状態を片付けるのが一番確実。途中経過も消す。
    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript('')
    }

    // エラー時。種別だけ控える。'no-speech'(無音) や 'aborted'(中断) は
    //   日常的に起きるので、表示側で「うるさく出さない」よう扱いを分ける。
    recognition.onerror = (event) => {
      setError(event.error)
    }

    recognitionRef.current = recognition

    // 後始末: コンポーネントが消える（モーダルを閉じる等）ときに認識を止める。
    //   abort() は結果を捨てて即停止。リスナーも明示的に外して取りこぼしを防ぐ。
    return () => {
      recognition.onresult = null
      recognition.onstart = null
      recognition.onend = null
      recognition.onerror = null
      recognition.abort()
      recognitionRef.current = null
    }
    // lang を変えたら作り直す。isSupported はアプリ実行中に変わらないが依存に含めておく。
  }, [isSupported, lang])

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
