/**
 * `@platform/workflow` — 多段承認ワークフローの状態機械。
 *
 * 「申請 → 一次承認 → 二次承認 → 完了」のような承認フローを共通化する。
 * 外部依存なしの純ロジックで、状態の永続化はアプリ側の責務(状態を受け取り、
 * 次の状態を返す関数群を提供する)。ロールは `@platform/auth` と組み合わせて使う。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";

/** 承認ステップの定義。 */
export interface WorkflowStep {
  /** ステップ名(例: "課長承認")。 */
  name: string;
  /** このステップを承認できるロール(`@platform/auth` のロールと対応)。 */
  approverRole: string;
}

/** ワークフロー定義(順序付きの承認ステップ)。 */
export interface WorkflowDefinition {
  steps: WorkflowStep[];
}

/** ワークフローの状態。 */
export type WorkflowStatus = "pending" | "approved" | "rejected";

/** 履歴 1 件。 */
export interface WorkflowEvent {
  step: string;
  action: "approve" | "reject" | "sendback";
  actor: string;
  at: string;
  reason?: string;
}

/** ワークフローの現在状態(アプリはこれを保存する)。 */
export interface WorkflowState {
  status: WorkflowStatus;
  /** 現在待ちのステップ index(pending のときのみ有効)。 */
  currentStep: number;
  history: WorkflowEvent[];
}

/** 承認・却下する主体。 */
export interface Actor {
  id: string;
  roles: string[];
}

/**
 * ワークフローを開始し、初期状態を返す。
 * @param def ワークフロー定義
 * @returns 先頭ステップ待ちの pending 状態
 * @throws {@link @platform/core#AppError} `VALIDATION` — ステップが空の場合
 */
export function startWorkflow(def: WorkflowDefinition): WorkflowState {
  if (def.steps.length === 0) {
    throw new AppError(ErrorCode.VALIDATION, "ワークフローには最低1ステップが必要です");
  }
  return { status: "pending", currentStep: 0, history: [] };
}

function requireActorRole(step: WorkflowStep, actor: Actor): void {
  if (!actor.roles.includes(step.approverRole)) {
    throw new AppError(ErrorCode.FORBIDDEN, `このステップ(${step.name})を承認する権限がありません`, {
      details: { required: step.approverRole, actorRoles: actor.roles },
    });
  }
}

/**
 * 現在ステップを承認して次に進める。最終ステップなら approved になる。
 *
 * @param def   ワークフロー定義
 * @param state 現在状態
 * @param actor 承認者(適切なロールが必要)
 * @returns 次の状態の `ok`、または不整合・権限不足の `err`
 *
 * @example
 * ```ts
 * const next = approve(def, state, { id: "u1", roles: ["manager"] });
 * if (next.ok) save(next.value);
 * ```
 */
export function approve(
  def: WorkflowDefinition,
  state: WorkflowState,
  actor: Actor,
): Result<WorkflowState> {
  if (state.status !== "pending") {
    return err(new AppError(ErrorCode.VALIDATION, "完了済みのワークフローは操作できません"));
  }
  const step = def.steps[state.currentStep];
  if (!step) return err(new AppError(ErrorCode.INTERNAL, "ステップが不正です"));

  try {
    requireActorRole(step, actor);
  } catch (e) {
    return err(AppError.from(e));
  }

  const event: WorkflowEvent = {
    step: step.name,
    action: "approve",
    actor: actor.id,
    at: new Date().toISOString(),
  };
  const isLast = state.currentStep === def.steps.length - 1;
  return ok({
    status: isLast ? "approved" : "pending",
    currentStep: isLast ? state.currentStep : state.currentStep + 1,
    history: [...state.history, event],
  });
}

/**
 * 現在ステップで却下する。ワークフローは rejected で終了する。
 *
 * @param def    ワークフロー定義
 * @param state  現在状態
 * @param actor  却下者(適切なロールが必要)
 * @param reason 却下理由
 * @returns rejected 状態の `ok`、または不整合・権限不足の `err`
 */
export function reject(
  def: WorkflowDefinition,
  state: WorkflowState,
  actor: Actor,
  reason: string,
): Result<WorkflowState> {
  if (state.status !== "pending") {
    return err(new AppError(ErrorCode.VALIDATION, "完了済みのワークフローは操作できません"));
  }
  const step = def.steps[state.currentStep];
  if (!step) return err(new AppError(ErrorCode.INTERNAL, "ステップが不正です"));

  try {
    requireActorRole(step, actor);
  } catch (e) {
    return err(AppError.from(e));
  }

  return ok({
    status: "rejected",
    currentStep: state.currentStep,
    history: [
      ...state.history,
      { step: step.name, action: "reject", actor: actor.id, at: new Date().toISOString(), reason },
    ],
  });
}

/**
 * 差戻し。現在ステップの承認者が、前のステップ(既定は申請=step 0)へ戻す。
 * 却下と違い status は pending のまま、履歴に sendback を記録する。
 *
 * @param def    ワークフロー定義
 * @param state  現在状態
 * @param actor  差戻す承認者(現在ステップのロールが必要)
 * @param options `toStep`(戻す先・既定 0)、`reason`(差戻し理由)
 * @returns 指定ステップ待ちの pending 状態の `ok`、または不整合・権限不足の `err`
 */
export function sendBack(
  def: WorkflowDefinition,
  state: WorkflowState,
  actor: Actor,
  options: { toStep?: number; reason?: string } = {},
): Result<WorkflowState> {
  if (state.status !== "pending") {
    return err(new AppError(ErrorCode.VALIDATION, "完了済みのワークフローは操作できません"));
  }
  const step = def.steps[state.currentStep];
  if (!step) return err(new AppError(ErrorCode.INTERNAL, "ステップが不正です"));

  try {
    requireActorRole(step, actor);
  } catch (e) {
    return err(AppError.from(e));
  }

  const toStep = options.toStep ?? 0;
  if (toStep < 0 || toStep >= state.currentStep) {
    return err(new AppError(ErrorCode.VALIDATION, "差戻し先は現在より前のステップである必要があります"));
  }

  return ok({
    status: "pending",
    currentStep: toStep,
    history: [
      ...state.history,
      { step: step.name, action: "sendback", actor: actor.id, at: new Date().toISOString(), reason: options.reason },
    ],
  });
}

/**
 * 現在待ちのステップを返す(pending 以外は null)。UI 表示に使う。
 * @param def   定義
 * @param state 状態
 */
export function currentStep(def: WorkflowDefinition, state: WorkflowState): WorkflowStep | null {
  if (state.status !== "pending") return null;
  return def.steps[state.currentStep] ?? null;
}

export { notificationForTransition, approverRecipients, type WorkflowNotification, type ApproverDirectory } from "./notification.js";
export * from "./routing.js";
export * from "./delegation.js";
export * from "./parallel.js";
export * from "./escalation.js";
