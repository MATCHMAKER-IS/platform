/**
 * 監査ログの検索・絞り込み(純ロジック)。
 * @packageDocumentation
 */
import { type AuditEntry } from "./log.js";

/** 操作者で絞る。 */
export function filterByActor(log: AuditEntry[], actor: string): AuditEntry[] {
  return log.filter((e) => e.actor === actor);
}

/** 対象で絞る。 */
export function filterByTarget(log: AuditEntry[], target: string): AuditEntry[] {
  return log.filter((e) => e.target === target);
}

/** 操作(前方一致。"expense." で経費関連すべて)で絞る。 */
export function filterByAction(log: AuditEntry[], actionPrefix: string): AuditEntry[] {
  return log.filter((e) => e.action === actionPrefix || e.action.startsWith(`${actionPrefix}.`) || e.action.startsWith(actionPrefix));
}

/** 期間(ISO 日付の from〜to、両端含む)で絞る。 */
export function filterByPeriod(log: AuditEntry[], from: string, to: string): AuditEntry[] {
  return log.filter((e) => e.at >= from && e.at <= `${to}T23:59:59.999Z`);
}

/** 対象ごとの操作履歴(時系列)を取り出す。 */
export function historyOf(log: AuditEntry[], target: string): AuditEntry[] {
  return filterByTarget(log, target).slice().sort((a, b) => a.seq - b.seq);
}
