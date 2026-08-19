"use client";
/**
 * 送信の状態管理(`idle` / `sending` / `done` / `error`)。
 *
 * 【なぜ要るか】
 * フォームの送信は**どの画面でも同じ形**になるのに、毎回書き直されている
 * (`internal-app` と `public-site` の問い合わせフォームで重複していた)。
 * 書き直すたびに**二重送信の防止が抜ける**のが最も困る——
 * 利用者は応答が無いと**もう一度押す**ので、問い合わせや申請が 2 件登録される。
 *
 * 【`@platform/form` の `useSubmitFlow` との使い分け】
 *
 * - **確認画面を挟まないなら `useSubmit`**(この関数)。問い合わせ・申請・保存。
 * - **入力 → 確認 → 完了の 3 段なら `useSubmitFlow`**。
 *   金額の大きい発注や、取り消せない操作で使う。
 *
 * 送信ボタンだけなら `@platform/form` の `SubmitButton` もある
 * (送信中は自動で無効化する)。
 *
 * @packageDocumentation
 */
import * as React from "react";

/** 送信の状態。 */
export type SubmitStatus = "idle" | "sending" | "done" | "error";

/** {@link useSubmit} が返すもの。 */
export interface SubmitState {
  /** 現在の状態。 */
  status: SubmitStatus;
  /** 失敗したときの説明(利用者に見せる文言)。 */
  error: string;
  /**
   * 送信する。**送信中は無視される**(二重送信の防止)。
   *
   * 渡した関数が投げなければ `done`、投げれば `error` になる。
   */
  submit: (run: () => Promise<void>) => Promise<void>;
  /** `idle` に戻す(もう一度送れるようにする)。 */
  reset: () => void;
  /** 送信中か(ボタンを `disabled` にするため)。 */
  sending: boolean;
}

/**
 * 送信の状態を管理する。
 *
 * **二重送信を防ぐ。** 送信中に再び呼ばれても**何もしない**——
 * 利用者は応答が無いと**もう一度押す**ので、防がないと
 * **問い合わせや申請が 2 件登録される**。ボタンを `disabled` にするだけでは
 * 足りない(Enter キーや連打の間に合わない)。
 *
 * **エラーの文言は渡した関数が決める。** 投げた例外の `message` をそのまま使うので、
 * **利用者に見せてよい文言**にすること——`AppError` の説明文や、
 * サーバが返した `error` を渡す。内部の例外をそのまま投げると、
 * **スタックトレースや SQL が画面に出る**。
 *
 * @param options.onDone 成功したときに呼ばれる(入力欄を空にするなど)
 * @param options.fallbackMessage 例外に `message` が無いときの文言
 * @returns 状態と `submit`
 *
 * @example
 * ```tsx
 * const { status, error, submit, sending } = useSubmit({ onDone: () => setForm(EMPTY) });
 *
 * const onSubmit = (e: FormEvent) => {
 *   e.preventDefault();
 *   void submit(async () => {
 *     const res = await fetch("/api/contact", { method: "POST", body: JSON.stringify(form) });
 *     if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "送信に失敗しました");
 *   });
 * };
 *
 * <button type="submit" disabled={sending}>{sending ? "送信中…" : "送信"}</button>
 * {status === "error" && <p role="alert">{error}</p>}
 * ```
  *
 * **タイムアウトは持たない。** 2026-08 に検討して**入れない判断**をした:
 *
 * - `run` の中で `fetch` しているので、**時間切れにしても送信は止まらない**
 *   (`AbortSignal` を呼び出し側まで通す必要がある)
 * - 止まらないまま「失敗」と伝えると、**利用者はリロードして再送する**
 *   ——**送信されたか分からない**状態が一番危ない
 * - サーバ側(`@platform/integrations` / 各 API)は**タイムアウトを持って**いるので、
 *   **実際には数十秒で応答が返る**
 *
 * **入れるなら `AbortSignal` を通す形**にすること。時間切れで済ませてはいけない。
 */
export function useSubmit(options: { onDone?: () => void; fallbackMessage?: string } = {}): SubmitState {
  const [status, setStatus] = React.useState<SubmitStatus>("idle");
  const [error, setError] = React.useState("");
  // **`useRef` で見張る。** `status` は再描画まで更新されないので、
  // 連打の間に 2 回目が通ってしまう
  const running = React.useRef(false);

  const submit = React.useCallback(
    async (run: () => Promise<void>): Promise<void> => {
      if (running.current) return;
      running.current = true;
      setStatus("sending");
      setError("");
      try {
        await run();
        setStatus("done");
        options.onDone?.();
      } catch (e) {
        setStatus("error");
        setError(
          e instanceof Error && e.message !== ""
            ? e.message
            : (options.fallbackMessage ?? "送信に失敗しました。時間をおいて再度お試しください。"),
        );
      } finally {
        running.current = false;
      }
    },
    [options],
  );

  const reset = React.useCallback(() => {
    setStatus("idle");
    setError("");
  }, []);

  return { status, error, submit, reset, sending: status === "sending" };
}
