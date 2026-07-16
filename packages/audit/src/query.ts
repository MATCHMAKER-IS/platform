/**
 * 監査ログの検索・絞り込み(純ロジック)。
 * @packageDocumentation
 */
import { type AuditEntry } from "./log.js";

/**
 * 操作者で絞り込む。
 *
 * @param log 監査ログ
 * @param actor 操作者
 * @returns その人の操作履歴
 */
export function filterByActor(log: AuditEntry[], actor: string): AuditEntry[] {
  return log.filter((e) => e.actor === actor);
}

/**
 * 対象で絞り込む。
 *
 * @param log 監査ログ
 * @param target 対象(`expense:123` など)
 * @returns その対象への操作履歴
 */
export function filterByTarget(log: AuditEntry[], target: string): AuditEntry[] {
  return log.filter((e) => e.target === target);
}

/**
 * 操作で絞り込む(**前方一致**)。
 *
 * `expense.` で経費関連すべてを拾える(`expense.create` / `expense.approve` など)。
 *
 * @param log 監査ログ
 * @param action 操作(前方一致)
 * @returns その操作の履歴
 */
export function filterByAction(log: AuditEntry[], actionPrefix: string): AuditEntry[] {
  return log.filter((e) => e.action === actionPrefix || e.action.startsWith(`${actionPrefix}.`) || e.action.startsWith(actionPrefix));
}

/**
 * 期間で絞り込む。
 *
 * @param log 監査ログ
 * @param from 開始(ISO)
 * @param to 終了(ISO。**この日を含む**)
 * @returns 期間内の履歴
 */
export function filterByPeriod(log: AuditEntry[], from: string, to: string): AuditEntry[] {
  return log.filter((e) => e.at >= from && e.at <= `${to}T23:59:59.999Z`);
}

/**
 * 対象ごとの操作履歴を時系列で取り出す。
 *
 * **「この申請は誰がいつ何をしたか」を追う**のに使う(調査の基本)。
 *
 * @param log 監査ログ
 * @param target 対象
 * @returns 時系列の履歴(**古い順**。経緯を追うため)
 */
export function historyOf(log: AuditEntry[], target: string): AuditEntry[] {
  return filterByTarget(log, target).slice().sort((a, b) => a.seq - b.seq);
}
