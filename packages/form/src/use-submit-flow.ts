/**
 * 入力 → 確認 → 完了 フローの React フック(クライアント専用)。
 * flow.ts の状態遷移を useState で束ね、非同期の送信処理を配線する。二重送信を防ぐ。
 * @packageDocumentation
 */
import { useState, useCallback } from "react";
import {
  type SubmitFlowState, type SubmitPhase,
  initialSubmitFlow, reviewData, editAgain, startSubmitting, submitFailed, submitSucceeded, resetSubmitFlow,
} from "./flow";

/** useSubmitFlow の戻り値。 */
export interface UseSubmitFlow<T> {
  /** 現在の段階。 */
  phase: SubmitPhase;
  /** 保持中の入力データ。 */
  data: T | null;
  /** 送信中か。 */
  submitting: boolean;
  /** 送信エラー。 */
  error: string | null;
  /** 入力 → 確認(データを保持)。 */
  toConfirm: (data: T) => void;
  /** 確認 → 入力(再編集)。 */
  toEdit: () => void;
  /** 送信を実行(確認 → 完了)。onSubmit が投げれば確認画面に留まりエラー表示。 */
  submit: (onSubmit: (data: T) => Promise<void>) => Promise<void>;
  /** 最初からやり直す。 */
  reset: () => void;
}

/**
 * 入力 → 確認 → 完了フローを管理するフック。
 *
 * **二重送信は自動で防ぐ**(送信中は `submitting` になり、`submit` を呼んでも無視される)。
 *
 * @returns 現在の段階と操作(`toConfirm` / `back` / `submit` / `reset`)
 */
export function useSubmitFlow<T>(): UseSubmitFlow<T> {
  const [state, setState] = useState<SubmitFlowState<T>>(() => initialSubmitFlow<T>());

  const toConfirm = useCallback((data: T) => setState((s) => reviewData(s, data)), []);
  const toEdit = useCallback(() => setState((s) => editAgain(s)), []);
  const reset = useCallback(() => setState(resetSubmitFlow<T>()), []);

  const submit = useCallback(async (onSubmit: (data: T) => Promise<void>) => {
    let current: SubmitFlowState<T> | null = null;
    setState((s) => { current = s; return startSubmitting(s); });
    if (!current || (current as SubmitFlowState<T>).data === null) return;
    try {
      await onSubmit((current as SubmitFlowState<T>).data as T);
      setState((s) => submitSucceeded(s));
    } catch (e) {
      setState((s) => submitFailed(s, e instanceof Error ? e.message : "送信に失敗しました"));
    }
  }, []);

  return { phase: state.phase, data: state.data, submitting: state.submitting, error: state.error, toConfirm, toEdit, submit, reset };
}
