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

/**
 * 並列承認の初期状態を作る。
 *
 * @returns 初期状態
 */
export function startParallel(): ParallelState {
  return { approvedRoles: [], approvedBy: [] };
}

/**
 * 承認を **1 票**記録する。
 *
 * **1 人 1 票。** 兼務(経理と法務を同じ人が見る等)は中小企業では普通なので、
 * 複数ロールを持つ人でも**埋まるのは 1 ロールだけ**にしてある——
 * 一度に全部埋められると「全部署の承認が要る(`all`)」という設計意図が成立しない。
 * 埋まるのは `approverRoles` のうち**まだ承認されていない最初のもの**。
 *
 * 対象ロールを持たない場合、**同じ人が二度呼んだ場合**は状態を変えない。
 *
 * @param step 並列ステップの定義(必要なロールと `all` / `any`)
 * @param state 現在の承認状況
 * @param actor 承認した人(`id` で 1 人 1 票を判定する)
 * @returns 更新した**新しい状態**(元は変更しない)
 */
export function recordParallelApproval(
  step: ParallelStep,
  state: ParallelState,
  actor: { id: string; roles: string[] },
): ParallelState {
  const available = step.approverRoles.filter((r) => actor.roles.includes(r) && !state.approvedRoles.includes(r));
  if (available.length === 0) return state;
  // **同じ人は 2 回目以降を数えない。** 兼務(経理と法務を同じ人が見る等)は
  // 中小企業では普通で、複数ロールを持つ人が**一度に全ロールを埋められる**と
  // 「全部署の承認が要る(all)」という設計意図が成立しない。
  // 二重チェックのための仕組みなので、**1 人 1 票**にする(2026-08)。
  if (state.approvedBy.some((a) => a.actorId === actor.id)) return state;
  // **1 回の呼び出しで埋めるのも 1 ロールだけ。** 兼務者が複数ロールを持っていても、
  // 承認は 1 つ分として数える(残りは別の人が承認する必要がある)。
  const role = available[0];
  if (role === undefined) return state;
  return {
    approvedRoles: [...state.approvedRoles, role],
    approvedBy: [...state.approvedBy, { actorId: actor.id, role }],
  };
}

/**
 * 並列ステップが完了したかを判定する。
 *
 * **`all` は全員、`any` は 1 人**で完了。用途で使い分ける
 * (契約は全部署の承認が要る = all、緊急対応は誰か 1 人でよい = any)。
 *
 * @param step 並列承認の段階（**何人の承認が要るか**を持つ）
 * @param state 並列承認の状態
 * @returns 完了していれば true
 */
export function isParallelComplete(step: ParallelStep, state: ParallelState): boolean {
  const approvedNeeded = step.approverRoles.filter((r) => state.approvedRoles.includes(r));
  return (step.mode ?? "all") === "any" ? approvedNeeded.length >= 1 : approvedNeeded.length === step.approverRoles.length;
}

/**
 * まだ承認が必要なロールを返す。
 *
 * **画面に「あと誰の承認待ちか」を出す**のに使う。
 * `any` モードでは未承認なら全ロールが候補(誰が承認してもよい)。
 *
 * @param step 並列承認の段階（**何人の承認が要るか**を持つ）
 * @param state 並列承認の状態
 * @returns 承認待ちのロール
 */
export function remainingApprovers(step: ParallelStep, state: ParallelState): string[] {
  if (isParallelComplete(step, state)) return [];
  return step.approverRoles.filter((r) => !state.approvedRoles.includes(r));
}
