"use client";
/**
 * 共通 VoiceInput。マイクボタン付きのテキスト入力。話した内容を認識して欄に追記する。
 * 内部は Web Speech API(useSpeechRecognition)。バックエンド不要。
 * @packageDocumentation
 */
import * as React from "react";
import { Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "./use-speech-recognition.js";
import { cn } from "../lib/cn.js";

/** {@link VoiceInput} の props。 */
export interface VoiceInputProps {
  /** 現在の値。 */
  value: string;
  /** 値が変わったとき(手入力・音声どちらも)。 */
  onChange: (value: string) => void;
  /** 認識言語(既定 "ja-JP")。 */
  lang?: string;
  placeholder?: string;
  /** 複数行(textarea)にするか。 */
  multiline?: boolean;
  className?: string;
}

/**
 * 音声入力できるテキストフィールド。マイクを押して話すと認識結果が欄に追記される。
 * @example
 * ```tsx
 * <VoiceInput value={memo} onChange={setMemo} placeholder="話しかけてください" />
 * ```
 */
export function VoiceInput({ value, onChange, lang = "ja-JP", placeholder, multiline, className }: VoiceInputProps) {
  const sr = useSpeechRecognition({ lang });
  const base = React.useRef(value);

  // 認識が始まったときの元テキストを基準に、確定分を足していく
  React.useEffect(() => {
    if (sr.listening && sr.transcript) {
      onChange(`${base.current}${base.current && !base.current.endsWith(" ") ? " " : ""}${sr.transcript}`);
    }
  }, [sr.transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    if (sr.listening) { sr.stop(); return; }
    base.current = value;
    sr.reset();
    sr.start();
  };

  const commonProps = {
    value,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    className: cn(
      "w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 pr-11 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
      multiline ? "min-h-[80px] py-2" : "h-10",
    ),
  };

  return (
    <div className={cn("relative", className)}>
      {multiline ? <textarea {...commonProps} /> : <input {...commonProps} />}
      <button
        type="button"
        onClick={toggle}
        disabled={!sr.supported}
        aria-label={sr.listening ? "音声入力を停止" : "音声入力を開始"}
        aria-pressed={sr.listening}
        title={sr.supported ? undefined : "このブラウザは音声入力に非対応です"}
        className={cn(
          "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors disabled:opacity-40",
          sr.listening ? "animate-pulse bg-[var(--color-danger)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
        )}
      >
        {sr.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
      {sr.listening && sr.interim && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">認識中: {sr.interim}</p>
      )}
      {sr.error && <p className="mt-1 text-xs text-[var(--color-danger)]">{sr.error}</p>}
    </div>
  );
}
