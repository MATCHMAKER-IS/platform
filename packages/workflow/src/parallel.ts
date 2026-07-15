/**
 * 並列承認(同一ステップに複数の承認者)。全員承認(all)/誰か一人(any)を選べる。
 * 稟議の「関係部署の合議」「複数役員の承認」などに使う。純ロジックで状態を進める。
 * @packageDocumentation
 */

/** 並列承認ステップの定義。 */
export interface ParallelStep {
  name: string;
  /** 承認が必要なロール群。 */
  approverRoles: string[];
  /** 完了条件。"all"=全ロール承認, "any"=いずれか1つ(既定 "all")。 */
  mode?: "all" | "any";
}

/** 並列承認の進捗状態。 */
export interface ParallelState {
  /** 承認済みのロール。 */
  approvedRoles: string[];
  /** 誰がどのロールで承認したか(監査用)。 */
  approvedBy: { actorId: string; role: string }[];
}

/** 初期状態。 */
export function startParallel(): ParallelState {
  return { approvedRoles: [], approvedBy: [] };
}

/**
 * 承認を記録する(actor が持つロールのうち、まだ承認されていない必要ロールを承認済みにする)。
 * 対象ロールを持たない場合や既に承認済みの場合は状態を変えない。
 */
export function recordParallelApproval(
  step: ParallelStep,
  state: ParallelState,
  actor: { id: string; roles: string[] },
): ParallelState {
  const need = step.approverRoles.filter((r) => actor.roles.includes(r) && !state.approvedRoles.includes(r));
  if (need.length === 0) return state;
  return {
    approvedRoles: [...state.approvedRoles, ...need],
    approvedBy: [...state.approvedBy, ...need.map((role) => ({ actorId: actor.id, role }))],
  };
}

/** 並列ステップが完了したか(mode に応じて判定)。 */
export function isParallelComplete(step: ParallelStep, state: ParallelState): boolean {
  const approvedNeeded = step.approverRoles.filter((r) => state.approvedRoles.includes(r));
  return (step.mode ?? "all") === "any" ? approvedNeeded.length >= 1 : approvedNeeded.length === step.approverRoles.length;
}

/** まだ承認が必要なロール(all モードでの残り。any モードでは未承認なら全ロールが候補)。 */
export function remainingApprovers(step: ParallelStep, state: ParallelState): string[] {
  if (isParallelComplete(step, state)) return [];
  return step.approverRoles.filter((r) => !state.approvedRoles.includes(r));
}
