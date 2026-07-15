/**
 * 監査ログのアプリ層サービス(基盤 @platform/audit の合成)。
 * 業務操作(経費の提出・承認、請求発行など)を追記専用ログに記録し、改ざん検知・履歴取得を提供する。
 * @packageDocumentation
 */
import { appendEvent, verifyChain, historyOf, filterByActor, filterByPeriod, describeEvent, diffChanges, type AuditEntry, type AuditEvent } from "@platform/audit";

/** 業務操作を監査イベントとして記録する。 */
export function record(
  log: AuditEntry[],
  input: { actor: string; action: string; target: string; before?: Record<string, unknown>; after?: Record<string, unknown>; meta?: Record<string, unknown> },
): AuditEntry[] {
  const event: AuditEvent = { at: new Date().toISOString(), ...input };
  return appendEvent(log, event);
}

/** 状態遷移を記録する(before/after の状態を差分として残す)。 */
export function recordTransition(
  log: AuditEntry[],
  actor: string,
  target: string,
  action: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AuditEntry[] {
  return record(log, { actor, action, target, before, after });
}

/** ログが改ざんされていないか。 */
export function isLogIntact(log: AuditEntry[]): boolean {
  return verifyChain(log).valid;
}

/** 対象(例: "expense:123")の操作履歴を時系列で返す。 */
export function historyFor(log: AuditEntry[], target: string): AuditEntry[] {
  return historyOf(log, target);
}

/** 操作者の操作を返す。 */
export function actionsBy(log: AuditEntry[], actor: string): AuditEntry[] {
  return filterByActor(log, actor);
}

/** 期間で絞る。 */
export function inPeriod(log: AuditEntry[], from: string, to: string): AuditEntry[] {
  return filterByPeriod(log, from, to);
}

export { describeEvent, diffChanges };
export type { AuditEntry, AuditEvent } from "@platform/audit";
