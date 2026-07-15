/**
 * 入力 → 確認 → 完了 の画面遷移フロー(純ロジック)。
 * 日本の業務アプリで定番の「入力画面で入力 → 確認画面で見直し → 送信 → 完了画面」を状態として扱う。
 * 確認画面のために入力データを保持し、送信の成否・戻る(再編集)を管理する。React 非依存。
 * @packageDocumentation
 */

/** フローの段階。 */
export type SubmitPhase = "input" | "confirm" | "complete";

/** フローの状態。 */
export interface SubmitFlowState<T> {
  /** 現在の段階。 */
  phase: SubmitPhase;
  /** 確認・完了画面で表示するために保持する入力データ。 */
  data: T | null;
  /** 送信処理中か。 */
  submitting: boolean;
  /** 送信エラー(あれば)。 */
  error: string | null;
}

/** 初期状態(入力画面)。 */
export function initialSubmitFlow<T>(): SubmitFlowState<T> {
  return { phase: "input", data: null, submitting: false, error: null };
}

/** 入力 → 確認(入力データを保持して確認画面へ)。 */
export function reviewData<T>(_state: SubmitFlowState<T>, data: T): SubmitFlowState<T> {
  return { phase: "confirm", data, submitting: false, error: null };
}

/** 確認 → 入力(再編集。保持したデータは残す)。 */
export function editAgain<T>(state: SubmitFlowState<T>): SubmitFlowState<T> {
  return { ...state, phase: "input", submitting: false, error: null };
}

/** 送信開始(確認画面で submitting に。二重送信防止に使う)。 */
export function startSubmitting<T>(state: SubmitFlowState<T>): SubmitFlowState<T> {
  return { ...state, submitting: true, error: null };
}

/** 送信失敗(確認画面に留まりエラー表示)。 */
export function submitFailed<T>(state: SubmitFlowState<T>, error: string): SubmitFlowState<T> {
  return { ...state, submitting: false, error };
}

/** 送信成功 → 完了画面。 */
export function submitSucceeded<T>(state: SubmitFlowState<T>): SubmitFlowState<T> {
  return { ...state, phase: "complete", submitting: false, error: null };
}

/** 最初からやり直す(完了画面から新規入力へ)。 */
export function resetSubmitFlow<T>(): SubmitFlowState<T> {
  return initialSubmitFlow<T>();
}

/** 進行状況のラベル(ステップインジケータ表示用)。 */
export const SUBMIT_PHASES: readonly SubmitPhase[] = ["input", "confirm", "complete"] as const;

/** 段階の番号(0=入力, 1=確認, 2=完了)。 */
export function phaseIndex(phase: SubmitPhase): number {
  return SUBMIT_PHASES.indexOf(phase);
}
