/**
 * 監査ログの異常検知。大量削除・ログイン失敗の連続・深夜の操作などを検出し、管理者への通知に使う。純粋な検出のみ。
 * @packageDocumentation
 */

/** 検査対象イベント（監査ログの一部）。 */
export interface AuditEvent {
  actor: string;
  action: string;
  target?: string;
  at: string;
}

/** 検出された異常。 */
export interface Anomaly {
  level: "warning" | "critical";
  kind: "mass_delete" | "login_failures" | "off_hours";
  title: string;
  detail: string;
  actor: string;
}

/** 検出のしきい値・設定。 */
export interface AnomalyOptions {
  /** この件数以上の削除操作で「大量削除」。既定 5。 */
  massDeleteThreshold?: number;
  /** この件数以上のログイン失敗で「連続失敗」。既定 5。 */
  loginFailureThreshold?: number;
  /** 深夜帯の開始時刻（時、含む）。既定 0。 */
  nightStartHour?: number;
  /** 深夜帯の終了時刻（時、含まない）。既定 6。 */
  nightEndHour?: number;
}

const isDelete = (a: string) => /delete|remove|rollback|purge/i.test(a);
const isLoginFailure = (a: string) => /fail|lock|denied|invalid/i.test(a);
const hourOf = (at: string): number => {
  const h = Number(at.slice(11, 13));
  return Number.isNaN(h) ? -1 : h;
};

function countByActor(events: AuditEvent[], pred: (e: AuditEvent) => boolean): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) if (pred(e)) m.set(e.actor, (m.get(e.actor) ?? 0) + 1);
  return m;
}

const LEVEL_ORDER: Record<Anomaly["level"], number> = { critical: 0, warning: 1 };

/** 監査イベントから異常を検出する（重大→警告の順）。 */
export function detectAnomalies(events: AuditEvent[], opts: AnomalyOptions = {}): Anomaly[] {
  const massDeleteThreshold = opts.massDeleteThreshold ?? 5;
  const loginFailureThreshold = opts.loginFailureThreshold ?? 5;
  const nightStart = opts.nightStartHour ?? 0;
  const nightEnd = opts.nightEndHour ?? 6;
  const anomalies: Anomaly[] = [];

  for (const [actor, count] of countByActor(events, (e) => isDelete(e.action))) {
    if (count >= massDeleteThreshold) anomalies.push({ level: "critical", kind: "mass_delete", title: "短時間での大量削除", detail: `${actor} が削除系操作を ${count} 件実行しました`, actor });
  }
  for (const [actor, count] of countByActor(events, (e) => isLoginFailure(e.action))) {
    if (count >= loginFailureThreshold) anomalies.push({ level: "critical", kind: "login_failures", title: "ログイン失敗の連続", detail: `${actor} のログイン失敗が ${count} 件あります`, actor });
  }
  for (const [actor, count] of countByActor(events, (e) => { const h = hourOf(e.at); return h >= 0 && h >= nightStart && h < nightEnd; })) {
    anomalies.push({ level: "warning", kind: "off_hours", title: "深夜帯の操作", detail: `${actor} が深夜帯(${nightStart}〜${nightEnd}時)に ${count} 件の操作を行いました`, actor });
  }

  return anomalies.sort((a, b) => (LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]) || (a.actor < b.actor ? -1 : 1));
}

/** 異常の要約テキスト（通知本文用）。 */
export function anomalyDigest(anomalies: Anomaly[]): string {
  if (anomalies.length === 0) return "検出された異常はありません。";
  return anomalies.map((a) => `[${a.level === "critical" ? "重大" : "警告"}] ${a.title}: ${a.detail}`).join("\n");
}
