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

/**
 * 初期状態(入力画面)を作る。
 *
 * @param data 初期値(任意)
 * @returns 入力画面の状態
 */
export function initialSubmitFlow<T>(): SubmitFlowState<T> {
  return { phase: "input", data: null, submitting: false, error: null };
}

/**
 * 入力 → 確認へ進む。
 *
 * **入力データを保持する**ので、確認画面から戻っても入力し直しにならない。
 *
 * @param data 入力されたデータ
 * @returns 確認画面の状態
 */
export function reviewData<T>(_state: SubmitFlowState<T>, data: T): SubmitFlowState<T> {
  return { phase: "confirm", data, submitting: false, error: null };
}

/**
 * 確認 → 入力へ戻る(再編集)。
 *
 * **保持したデータは残る**。「戻る」で入力が消えるのは、利用者が最も嫌う挙動。
 *
 * @param state 確認画面の状態
 * @returns 入力画面の状態(データ保持)
 */
export function editAgain<T>(state: SubmitFlowState<T>): SubmitFlowState<T> {
  return { ...state, phase: "input", submitting: false, error: null };
}

/**
 * 送信を開始する。
 *
 * **二重送信の防止に使う**。この状態のときは送信ボタンを無効にする
 * (連打で申請が 2 件登録される事故を防ぐ)。
 *
 * @param state 確認画面の状態
 * @returns 送信中の状態
 */
export function startSubmitting<T>(state: SubmitFlowState<T>): SubmitFlowState<T> {
  return { ...state, submitting: true, error: null };
}

/**
 * 送信に失敗する。
 *
 * **確認画面に留まる**(入力画面まで戻さない)。データは残っているので、
 * 原因を直して再送信できる。
 *
 * @param state 送信中の状態
 * @param error エラーメッセージ
 * @returns 確認画面の状態(エラー付き)
 */
export function submitFailed<T>(state: SubmitFlowState<T>, error: string): SubmitFlowState<T> {
  return { ...state, submitting: false, error };
}

/**
 * 送信に成功する。
 *
 * @param state 送信中の状態
 * @param result 送信結果(任意)
 * @returns 完了画面の状態
 */
export function submitSucceeded<T>(state: SubmitFlowState<T>): SubmitFlowState<T> {
  return { ...state, phase: "complete", submitting: false, error: null };
}

/**
 * 最初からやり直す(完了画面から新規入力へ)。
 *
 * **データは引き継がない**(前の申請の内容が残っていると誤送信の元)。
 *
 * @returns 入力画面の状態(空)
 */
export function resetSubmitFlow<T>(): SubmitFlowState<T> {
  return initialSubmitFlow<T>();
}

/** 進行状況のラベル(ステップインジケータ表示用)。 */
export const SUBMIT_PHASES: readonly SubmitPhase[] = ["input", "confirm", "complete"] as const;

/**
 * 段階の番号を返す(進捗表示用)。
 *
 * @param state フローの状態
 * @returns 0=入力 / 1=確認 / 2=完了
 */
export function phaseIndex(phase: SubmitPhase): number {
  return SUBMIT_PHASES.indexOf(phase);
}
