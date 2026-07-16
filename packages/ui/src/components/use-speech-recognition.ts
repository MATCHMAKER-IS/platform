"use client";
/**
 * Web Speech API(SpeechRecognition)をラップする音声認識フック。
 * ブラウザ標準機能でサーバ不要。日本語(ja-JP)を既定にする。
 * 未対応ブラウザでは supported=false を返す。
 * @packageDocumentation
 */
import * as React from "react";

/** 最小限の SpeechRecognition 型(標準 lib に含まれない環境向け)。 */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionResultEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export interface UseSpeechRecognitionOptions {
  /** 認識言語(既定 "ja-JP")。 */
  lang?: string;
  /** 連続認識(話し続ける)か。既定 false。 */
  continuous?: boolean;
}

export interface SpeechRecognitionState {
  /** この環境で音声認識が使えるか。 */
  supported: boolean;
  /** 認識中か。 */
  listening: boolean;
  /** 確定したテキスト(呼び出し以降の累積)。 */
  transcript: string;
  /** 認識途中の暫定テキスト。 */
  interim: string;
  /** エラーメッセージ。 */
  error: string | null;
  /** 認識開始。 */
  start: () => void;
  /** 認識停止。 */
  stop: () => void;
  /** transcript をクリア。 */
  reset: () => void;
}

/**
 * 音声認識フック。
 *
 *
 * @param options.lang 言語(既定 ja-JP)
 * @param options.continuous 継続して認識するか
 * @returns 認識結果と操作。**Chrome 系のみ・HTTPS 必須**
 */
export function useSpeechRecognition({ lang = "ja-JP", continuous = false }: UseSpeechRecognitionOptions = {}): SpeechRecognitionState {
  const [listening, setListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [interim, setInterim] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const recRef = React.useRef<SpeechRecognitionLike | null>(null);

  const Ctor = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    return (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
      .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition ?? null;
  }, []);

  const start = React.useCallback(() => {
    if (!Ctor) { setError("このブラウザは音声入力に対応していません"); return; }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let fin = "";
      let itr = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) fin += r[0].transcript;
        else itr += r[0].transcript;
      }
      if (fin) setTranscript((prev) => prev + fin);
      setInterim(itr);
    };
    rec.onerror = (e) => setError(e.error === "not-allowed" ? "マイクの使用が許可されていません" : "音声認識でエラーが発生しました");
    rec.onend = () => { setListening(false); setInterim(""); };
    recRef.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  }, [Ctor, lang, continuous]);

  const stop = React.useCallback(() => { recRef.current?.stop(); setListening(false); }, []);
  const reset = React.useCallback(() => { setTranscript(""); setInterim(""); }, []);

  React.useEffect(() => () => recRef.current?.abort(), []);

  return { supported: !!Ctor, listening, transcript, interim, error, start, stop, reset };
}
